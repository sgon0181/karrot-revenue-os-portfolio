from __future__ import annotations

import json
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .matching import FacilityIndex, FacilityRef, MatchResult
from .normalization import (
    abn_text,
    json_value,
    normalize_address,
    normalize_organisation,
    normalize_text,
    nullable_text,
    numeric,
    rating,
    split_semicolon,
    yes_no,
)
from .workbooks import (
    CARE_PERIODS,
    SourceRow,
    all_rows,
    column_starting_with,
    load_manifest,
    parse_date,
    read_care_minutes,
    read_provider_register,
    read_star_ratings,
    validate_manifest_files,
)


@dataclass
class ImportStats:
    rows_processed: int = 0
    records_created: int = 0
    records_updated: int = 0
    matched_records: int = 0
    unmatched_records: int = 0
    unresolved_records: int = 0
    duplicate_candidates: int = 0
    error_count: int = 0


def validate_archival_change(
    entity_name: str,
    active_count: int,
    missing_count: int,
    max_missing_fraction: float,
) -> None:
    if active_count < 0 or missing_count < 0 or missing_count > active_count:
        raise ValueError(f"Invalid {entity_name} archival counts")
    if not 0 <= max_missing_fraction <= 1:
        raise ValueError("max_missing_fraction must be between 0 and 1")
    if active_count == 0:
        return
    missing_fraction = missing_count / active_count
    if missing_fraction > max_missing_fraction:
        raise ValueError(
            f"Refusing to archive {missing_count} of {active_count} active {entity_name} "
            f"({missing_fraction:.1%}); manifest threshold is {max_missing_fraction:.1%}"
        )


class RevenueDatabase:
    def __init__(self, database_url: str, importer_version: str):
        self.connection = psycopg.connect(database_url, row_factory=dict_row)
        self.importer_version = importer_version

    def close(self) -> None:
        self.connection.close()

    def import_all(self, data_dir: Path) -> dict[str, Any]:
        manifest = load_manifest(data_dir)
        validate_manifest_files(data_dir, manifest)
        results = {
            "provider_register": self.import_provider_register(
                data_dir, manifest["acqsc_provider_register"]
            ),
            "star_ratings": self.import_star_ratings(data_dir, manifest["star_ratings"]),
            "care_minutes": self.import_care_minutes(data_dir, manifest["care_minutes"]),
        }
        return {"importer_version": self.importer_version, "datasets": results}

    def _source_file(self, item: dict[str, Any]) -> str:
        row = self.connection.execute(
            """
            insert into public.source_files (
              dataset_code, title, publisher, source_url, file_name, sha256,
              compiled_at, source_as_of_date, reporting_start_date,
              reporting_end_date, acquired_at, schema_version, metadata
            ) values (
              %(dataset_code)s, %(title)s, %(publisher)s, %(source_url)s,
              %(file_name)s, %(sha256)s, %(compiled_at)s,
              %(source_as_of_date)s, %(reporting_start_date)s,
              %(reporting_end_date)s, %(acquired_at)s, %(schema_version)s,
              %(metadata)s
            )
            on conflict (sha256) do update set
              dataset_code = excluded.dataset_code,
              title = excluded.title,
              publisher = excluded.publisher,
              source_url = excluded.source_url,
              file_name = excluded.file_name,
              metadata = excluded.metadata
            returning id
            """,
            {**item, "metadata": Jsonb({"manifest": item})},
        ).fetchone()
        self.connection.commit()
        return str(row["id"])

    def _start_run(self, source_file_id: str) -> str:
        row = self.connection.execute(
            """
            insert into public.import_runs (source_file_id, importer_version)
            values (%s, %s)
            returning id
            """,
            (source_file_id, self.importer_version),
        ).fetchone()
        self.connection.commit()
        return str(row["id"])

    def _finish_run(
        self,
        run_id: str,
        stats: ImportStats,
        details: dict[str, Any],
        error: Exception | None = None,
    ) -> None:
        status = "failed" if error else "succeeded"
        self.connection.execute(
            """
            update public.import_runs set
              status = %(status)s,
              finished_at = now(),
              rows_processed = %(rows_processed)s,
              records_created = %(records_created)s,
              records_updated = %(records_updated)s,
              matched_records = %(matched_records)s,
              unmatched_records = %(unmatched_records)s,
              unresolved_records = %(unresolved_records)s,
              duplicate_candidates = %(duplicate_candidates)s,
              error_count = %(error_count)s,
              details = %(details)s,
              error_message = %(error_message)s
            where id = %(run_id)s
            """,
            {
                **asdict(stats),
                "status": status,
                "details": Jsonb(details),
                "error_message": str(error) if error else None,
                "run_id": run_id,
            },
        )
        self.connection.commit()

    def _insert_source_records(
        self,
        source_file_id: str,
        rows: Iterable[SourceRow],
        stats: ImportStats,
    ) -> dict[tuple[str, int], int]:
        rows = list(rows)
        before = self.connection.execute(
            "select count(*) as count from public.source_records where source_file_id = %s",
            (source_file_id,),
        ).fetchone()["count"]
        with self.connection.cursor() as cursor:
            cursor.executemany(
                """
                insert into public.source_records (
                  source_file_id, sheet_name, row_number, row_hash, raw_data
                ) values (%s, %s, %s, %s, %s)
                on conflict (source_file_id, sheet_name, row_number) do nothing
                """,
                [
                    (
                        source_file_id,
                        row.sheet_name,
                        row.row_number,
                        row.hash,
                        Jsonb(row.json),
                    )
                    for row in rows
                ],
            )
        after = self.connection.execute(
            "select count(*) as count from public.source_records where source_file_id = %s",
            (source_file_id,),
        ).fetchone()["count"]
        stats.rows_processed += len(rows)
        stats.records_created += after - before
        records = self.connection.execute(
            """
            select id, sheet_name, row_number, row_hash
            from public.source_records
            where source_file_id = %s
            """,
            (source_file_id,),
        ).fetchall()
        expected_hashes = {
            (row.sheet_name, row.row_number): row.hash
            for row in rows
        }
        stored_hashes = {
            (row["sheet_name"], row["row_number"]): row["row_hash"]
            for row in records
        }
        if stored_hashes != expected_hashes:
            changed = sorted(
                locator
                for locator in stored_hashes.keys() | expected_hashes.keys()
                if stored_hashes.get(locator) != expected_hashes.get(locator)
            )
            preview = ", ".join(f"{sheet}!{row}" for sheet, row in changed[:10])
            raise ValueError(
                "Source-row identity changed for an existing file checksum; "
                f"refusing to mix parser revisions ({preview})"
            )
        return {(row["sheet_name"], row["row_number"]): row["id"] for row in records}

    def _issue(
        self,
        *,
        source_file_id: str,
        source_record_id: int,
        run_id: str,
        code: str,
        severity: str,
        summary: str,
        details: dict[str, Any],
        entity_type: str | None = None,
        entity_id: str | None = None,
    ) -> None:
        self.connection.execute(
            """
            insert into public.data_quality_issues (
              source_file_id, source_record_id, first_seen_run_id, last_seen_run_id,
              entity_type, entity_id, issue_code, severity, summary, details
            ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (source_record_id, issue_code) do update set
              last_seen_run_id = excluded.last_seen_run_id,
              last_seen_at = now(),
              status = 'open',
              resolved_at = null,
              resolution_note = null,
              severity = excluded.severity,
              summary = excluded.summary,
              details = excluded.details,
              entity_type = excluded.entity_type,
              entity_id = excluded.entity_id
            """,
            (
                source_file_id,
                source_record_id,
                run_id,
                run_id,
                entity_type,
                entity_id,
                code,
                severity,
                summary,
                Jsonb(details),
            ),
        )

    def import_provider_register(self, data_dir: Path, item: dict[str, Any]) -> dict[str, Any]:
        source_file_id = self._source_file(item)
        run_id = self._start_run(source_file_id)
        stats = ImportStats()
        details: dict[str, Any] = {}
        try:
            observed_at = item.get("compiled_at") or item["acquired_at"]
            out_of_order = self.connection.execute(
                """
                select exists (
                  select 1 from public.provider_snapshots where observed_at > %s
                  union all
                  select 1 from public.facility_snapshots where observed_at > %s
                ) as rejected
                """,
                (observed_at, observed_at),
            ).fetchone()["rejected"]
            if out_of_order:
                raise ValueError(
                    "Provider Register snapshot is older than canonical provider/facility state; "
                    "out-of-order authoritative imports are rejected"
                )
            sheets = read_provider_register(data_dir)
            source_ids = self._insert_source_records(
                source_file_id, all_rows(sheets), stats
            )
            provider_details = {
                abn_text(row.values["ABN"]): row for row in sheets["Provider Details"]
            }
            nsw_homes = [
                row
                for row in sheets["Residential Care Home Details"]
                if row.values["Residential Care Home State"] == "New South Wales"
            ]
            nsw_abns = sorted({abn_text(row.values["ABN"]) for row in nsw_homes})
            providers: dict[str, str] = {}

            for abn in nsw_abns:
                source = provider_details[abn]
                values = source.values
                source_record_id = source_ids[(source.sheet_name, source.row_number)]
                row = self.connection.execute(
                    """
                    insert into public.providers (
                      abn, entity_name, business_name, normalized_entity_name,
                      normalized_business_name, registration_status,
                      current_authoritative_source_record_id, first_seen_at, last_seen_at
                    ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    on conflict (abn) do update set
                      entity_name = excluded.entity_name,
                      business_name = excluded.business_name,
                      normalized_entity_name = excluded.normalized_entity_name,
                      normalized_business_name = excluded.normalized_business_name,
                      registration_status = excluded.registration_status,
                      current_authoritative_source_record_id = excluded.current_authoritative_source_record_id,
                      last_seen_at = greatest(public.providers.last_seen_at, excluded.last_seen_at),
                      archived_at = null
                    returning id, (xmax = 0) as inserted
                    """,
                    (
                        abn,
                        values["Entity Name"],
                        values["Business Name"],
                        normalize_organisation(values["Entity Name"]),
                        normalize_organisation(values["Business Name"]),
                        nullable_text(values["Registration Status"]),
                        source_record_id,
                        observed_at,
                        observed_at,
                    ),
                ).fetchone()
                provider_id = str(row["id"])
                providers[abn] = provider_id
                stats.records_created += int(row["inserted"])
                stats.records_updated += int(not row["inserted"])

                inserted = self.connection.execute(
                    """
                    insert into public.provider_snapshots (
                      provider_id, source_file_id, source_record_id, observed_at,
                      entity_name, business_name, registration_start_date,
                      registration_end_date, registration_lapse_date,
                      registration_status, street, suburb, state, postcode,
                      full_address, intends_special_program_delivery,
                      specialist_aged_care_programs, suspension, revocation,
                      banning_order
                    ) values (
                      %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    on conflict (provider_id, source_file_id) do nothing
                    """,
                    (
                        provider_id,
                        source_file_id,
                        source_record_id,
                        observed_at,
                        values["Entity Name"],
                        values["Business Name"],
                        parse_date(values["Registration Start Date"]),
                        parse_date(values["Registration End Date"]),
                        parse_date(values["Registration Lapse Date"]),
                        nullable_text(values["Registration Status"]),
                        nullable_text(values["Street"]),
                        nullable_text(values["Suburb"]),
                        nullable_text(values["State"]),
                        nullable_text(values["Postcode"]),
                        nullable_text(values["Full Address"]),
                        yes_no(
                            values[
                                "Is the provider intending to deliver services through NATSIFACP, MPS, CHSP or TCP?"
                            ]
                        ),
                        nullable_text(values["Specialist Aged Care Programs"]),
                        Jsonb(
                            {
                                "initiated_by": json_value(values["Suspension Initiated By"]),
                                "start_date": json_value(values["Suspension Start Date"]),
                                "end_date": json_value(values["Suspension End Date"]),
                                "reason": json_value(values["Suspension Reason"]),
                            }
                        ),
                        Jsonb(
                            {
                                "date": json_value(values["Revocation Date"]),
                                "initiated_by": json_value(values["Revocation Initiated By"]),
                                "reason": json_value(values["Revocation Reason"]),
                            }
                        ),
                        Jsonb(
                            {
                                "date": json_value(values["Provider Banning Order Date"]),
                                "register_link": json_value(values["Banning Order Register Link"]),
                            }
                        ),
                    ),
                ).rowcount
                stats.records_created += max(inserted, 0)

                for alias_type, key in (
                    ("entity_name", "Entity Name"),
                    ("business_name", "Business Name"),
                ):
                    stats.records_created += max(
                        self.connection.execute(
                            """
                            insert into public.provider_aliases (
                              provider_id, source_file_id, source_record_id,
                              alias_type, alias, normalized_alias
                            ) values (%s, %s, %s, %s, %s, %s)
                            on conflict do nothing
                            """,
                            (
                                provider_id,
                                source_file_id,
                                source_record_id,
                                alias_type,
                                values[key],
                                normalize_organisation(values[key]),
                            ),
                        ).rowcount,
                        0,
                    )

            facilities: dict[str, str] = {}
            for source in nsw_homes:
                values = source.values
                abn = abn_text(values["ABN"])
                provider_id = providers[abn]
                source_record_id = source_ids[(source.sheet_name, source.row_number)]
                site_id = str(values["Site ID"])
                row = self.connection.execute(
                    """
                    insert into public.facilities (
                      acqsc_site_id, provider_id, name, normalized_name, street,
                      suburb, normalized_suburb, state, postcode, full_address,
                      normalized_address, current_authoritative_source_record_id,
                      first_seen_at, last_seen_at
                    ) values (
                      %s, %s, %s, %s, %s, %s, %s, 'NSW', %s, %s, %s, %s, %s, %s
                    )
                    on conflict (acqsc_site_id) do update set
                      provider_id = excluded.provider_id,
                      name = excluded.name,
                      normalized_name = excluded.normalized_name,
                      street = excluded.street,
                      suburb = excluded.suburb,
                      normalized_suburb = excluded.normalized_suburb,
                      postcode = excluded.postcode,
                      full_address = excluded.full_address,
                      normalized_address = excluded.normalized_address,
                      current_authoritative_source_record_id = excluded.current_authoritative_source_record_id,
                      last_seen_at = greatest(public.facilities.last_seen_at, excluded.last_seen_at),
                      archived_at = null
                    returning id, (xmax = 0) as inserted
                    """,
                    (
                        site_id,
                        provider_id,
                        values["Name Of Each Home"],
                        normalize_text(values["Name Of Each Home"]),
                        values["Residential Care Home Street"],
                        values["Residential Care Home Suburb"],
                        normalize_text(values["Residential Care Home Suburb"]),
                        values["Residential Care Home Postcode"],
                        values["Residential Care Home Full Address"],
                        normalize_address(values["Residential Care Home Full Address"]),
                        source_record_id,
                        observed_at,
                        observed_at,
                    ),
                ).fetchone()
                facility_id = str(row["id"])
                facilities[site_id] = facility_id
                stats.records_created += int(row["inserted"])
                stats.records_updated += int(not row["inserted"])

                stats.records_created += max(
                    self.connection.execute(
                        """
                        insert into public.facility_snapshots (
                          facility_id, provider_id, source_file_id, source_record_id,
                          observed_at, acqsc_site_id, name, street, suburb, state,
                          postcode, full_address
                        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'NSW', %s, %s)
                        on conflict (facility_id, source_file_id) do nothing
                        """,
                        (
                            facility_id,
                            provider_id,
                            source_file_id,
                            source_record_id,
                            observed_at,
                            site_id,
                            values["Name Of Each Home"],
                            values["Residential Care Home Street"],
                            values["Residential Care Home Suburb"],
                            values["Residential Care Home Postcode"],
                            values["Residential Care Home Full Address"],
                        ),
                    ).rowcount,
                    0,
                )
                stats.records_created += max(
                    self.connection.execute(
                        """
                        insert into public.facility_aliases (
                          facility_id, source_file_id, source_record_id, alias,
                          normalized_alias, suburb, normalized_suburb,
                          provider_alias, normalized_provider_alias
                        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        on conflict do nothing
                        """,
                        (
                            facility_id,
                            source_file_id,
                            source_record_id,
                            values["Name Of Each Home"],
                            normalize_text(values["Name Of Each Home"]),
                            values["Residential Care Home Suburb"],
                            normalize_text(values["Residential Care Home Suburb"]),
                            values["Business Name"],
                            normalize_organisation(values["Business Name"]),
                        ),
                    ).rowcount,
                    0,
                )

            self._import_provider_auxiliary(
                sheets, source_ids, source_file_id, providers, stats
            )
            archival = self._archive_missing_register_entities(
                observed_at=observed_at,
                observed_abns=set(providers),
                observed_site_ids=set(facilities),
                policy=item.get("archival_policy"),
            )
            stats.records_updated += archival["providers_archived"]
            stats.records_updated += archival["facilities_archived"]
            stats.matched_records = len(nsw_homes)
            details = {
                "nsw_providers": len(providers),
                "nsw_facilities": len(facilities),
                "scope_rule": "Residential Care Home State equals New South Wales",
                "archival": archival,
            }
            self.connection.commit()
        except Exception as error:
            self.connection.rollback()
            stats.error_count += 1
            self._finish_run(run_id, stats, details, error)
            raise
        self._finish_run(run_id, stats, details)
        return {"run_id": run_id, **asdict(stats), **details}

    def _archive_missing_register_entities(
        self,
        *,
        observed_at: str,
        observed_abns: set[str],
        observed_site_ids: set[str],
        policy: dict[str, Any] | None,
    ) -> dict[str, Any]:
        if not policy or policy.get("mode") != "authoritative_full_snapshot":
            return {
                "mode": "disabled",
                "providers_archived": 0,
                "facilities_archived": 0,
            }
        if not observed_abns or not observed_site_ids:
            raise ValueError("Authoritative Provider Register snapshot contains no NSW entities")

        max_missing_fraction = float(policy.get("max_missing_fraction", 0.10))
        counts = self.connection.execute(
            """
            select
              (
                select count(*) from public.providers
                where archived_at is null and not is_sample
              ) as active_providers,
              (
                select count(*) from public.providers
                where archived_at is null and not is_sample
                  and not (abn = any(%s))
              ) as missing_providers,
              (
                select count(*) from public.facilities
                where archived_at is null and state = 'NSW' and not is_sample
              ) as active_facilities,
              (
                select count(*) from public.facilities
                where archived_at is null and state = 'NSW' and not is_sample
                  and not (acqsc_site_id = any(%s))
              ) as missing_facilities
            """,
            (sorted(observed_abns), sorted(observed_site_ids)),
        ).fetchone()

        validate_archival_change(
            "providers",
            int(counts["active_providers"]),
            int(counts["missing_providers"]),
            max_missing_fraction,
        )
        validate_archival_change(
            "facilities",
            int(counts["active_facilities"]),
            int(counts["missing_facilities"]),
            max_missing_fraction,
        )

        facilities_archived = self.connection.execute(
            """
            update public.facilities
            set archived_at = %s
            where archived_at is null
              and state = 'NSW'
              and not is_sample
              and not (acqsc_site_id = any(%s))
            """,
            (observed_at, sorted(observed_site_ids)),
        ).rowcount
        providers_archived = self.connection.execute(
            """
            update public.providers
            set archived_at = %s
            where archived_at is null
              and not is_sample
              and not (abn = any(%s))
            """,
            (observed_at, sorted(observed_abns)),
        ).rowcount

        return {
            "mode": "authoritative_full_snapshot",
            "max_missing_fraction": max_missing_fraction,
            "providers_archived": max(providers_archived, 0),
            "facilities_archived": max(facilities_archived, 0),
        }

    def _import_provider_auxiliary(
        self,
        sheets: dict[str, list[SourceRow]],
        source_ids: dict[tuple[str, int], int],
        source_file_id: str,
        providers: dict[str, str],
        stats: ImportStats,
    ) -> None:
        for source in sheets["Category & Service Type Details"]:
            values = source.values
            provider_id = providers.get(abn_text(values["ABN"]))
            if not provider_id:
                continue
            for service_type in split_semicolon(values["Service Type Name"]):
                stats.records_created += max(
                    self.connection.execute(
                        """
                        insert into public.provider_service_types (
                          provider_id, source_file_id, source_record_id,
                          registration_category, service_type
                        ) values (%s, %s, %s, %s, %s)
                        on conflict do nothing
                        """,
                        (
                            provider_id,
                            source_file_id,
                            source_ids[(source.sheet_name, source.row_number)],
                            values["Registered Category Name"],
                            service_type,
                        ),
                    ).rowcount,
                    0,
                )
        for source in sheets["Category & LGA Details"]:
            values = source.values
            provider_id = providers.get(abn_text(values["ABN"]))
            if not provider_id:
                continue
            for lga in split_semicolon(values["LGA"]):
                stats.records_created += max(
                    self.connection.execute(
                        """
                        insert into public.provider_lgas (
                          provider_id, source_file_id, source_record_id,
                          registration_category, lga
                        ) values (%s, %s, %s, %s, %s)
                        on conflict do nothing
                        """,
                        (
                            provider_id,
                            source_file_id,
                            source_ids[(source.sheet_name, source.row_number)],
                            values["Registered Category Name"],
                            lga,
                        ),
                    ).rowcount,
                    0,
                )
        for source in sheets["Regulatory Notices"]:
            values = source.values
            provider_id = providers.get(abn_text(values["ABN"]))
            if not provider_id:
                continue
            stats.records_created += max(
                self.connection.execute(
                    """
                    insert into public.provider_regulatory_notices (
                      provider_id, source_file_id, source_record_id, starts_on,
                      ends_on, detail_url, issued_by, status, notice_type,
                      detail, required_action
                    ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    on conflict (source_record_id) do nothing
                    """,
                    (
                        provider_id,
                        source_file_id,
                        source_ids[(source.sheet_name, source.row_number)],
                        parse_date(values["Regulatory Notice Start Date"]),
                        parse_date(values["Regulatory Notice End Date"]),
                        nullable_text(values["Link to Regulatory Notice Detail"]),
                        nullable_text(values["Regulatory Notice Issued By"]),
                        nullable_text(values["Regulatory Notice Status"]),
                        nullable_text(values["Regulatory Notice Type"]),
                        nullable_text(values["Regulatory Notice Detail"]),
                        nullable_text(
                            values[
                                "Regulatory Notice: Action Provider Must Take or Refrain From Taking"
                            ]
                        ),
                    ),
                ).rowcount,
                0,
            )

    def _facility_index(self) -> FacilityIndex:
        rows = self.connection.execute(
            """
            select
              f.id, f.acqsc_site_id, f.provider_id, p.abn, f.name, f.suburb,
              f.full_address, p.entity_name, p.business_name
            from public.facilities f
            join public.providers p on p.id = f.provider_id
            where f.archived_at is null and f.state = 'NSW'
              and not f.is_sample and not p.is_sample
            """
        ).fetchall()
        return FacilityIndex(
            FacilityRef(
                id=str(row["id"]),
                site_id=row["acqsc_site_id"],
                provider_id=str(row["provider_id"]),
                provider_abn=row["abn"],
                name=row["name"],
                suburb=row["suburb"],
                address=row["full_address"],
                provider_aliases=frozenset(
                    {
                        normalize_organisation(row["entity_name"]),
                        normalize_organisation(row["business_name"]),
                    }
                ),
            )
            for row in rows
        )

    def _decision(
        self,
        *,
        source_file_id: str,
        source_record_id: int,
        dataset_code: str,
        result: MatchResult,
    ) -> tuple[int, str, str | None]:
        existing = self.connection.execute(
            """
            select id, status, facility_id, reviewed_at
            from public.facility_match_decisions
            where source_record_id = %s
            """,
            (source_record_id,),
        ).fetchone()
        snapshot = self.connection.execute(
            """
            select facility_id, 'star_ratings'::text as dataset_code
            from public.star_rating_snapshots
            where source_record_id = %s
            union all
            select facility_id, 'care_minutes'::text as dataset_code
            from public.care_minutes_snapshots
            where source_record_id = %s
            """,
            (source_record_id, source_record_id),
        ).fetchone()
        if snapshot:
            if not existing:
                raise ValueError(
                    f"Source record {source_record_id} has an immutable snapshot but no match decision"
                )
            existing_facility_id = (
                str(existing["facility_id"]) if existing["facility_id"] else None
            )
            snapshot_facility_id = str(snapshot["facility_id"])
            if (
                snapshot["dataset_code"] != dataset_code
                or existing_facility_id != snapshot_facility_id
                or existing["status"] not in ("auto_confirmed", "confirmed")
            ):
                raise ValueError(
                    f"Source record {source_record_id} has inconsistent immutable match state"
                )
        if existing and (
            existing["status"] == "confirmed" or existing["reviewed_at"] is not None
        ):
            facility_id = (
                str(existing["facility_id"]) if existing["facility_id"] else None
            )
            return existing["id"], existing["status"], facility_id

        if snapshot:
            proposed_facility_id = result.facility.id if result.facility else None
            if (
                result.status not in ("auto_confirmed", "confirmed")
                or proposed_facility_id != str(snapshot["facility_id"])
            ):
                raise ValueError(
                    "Deterministic matching changed for source record "
                    f"{source_record_id}; existing snapshot is immutable and still points to "
                    f"facility {snapshot['facility_id']}"
                )
            return existing["id"], existing["status"], str(existing["facility_id"])

        facility_id = result.facility.id if result.facility else None
        row = self.connection.execute(
            """
            insert into public.facility_match_decisions (
              source_record_id, source_file_id, dataset_code, facility_id,
              status, match_method, evidence
            ) values (%s, %s, %s, %s, %s, %s, %s)
            on conflict (source_record_id) do update set
              facility_id = excluded.facility_id,
              status = excluded.status,
              match_method = excluded.match_method,
              evidence = excluded.evidence,
              updated_at = now()
            returning id, status, facility_id
            """,
            (
                source_record_id,
                source_file_id,
                dataset_code,
                facility_id,
                result.status,
                result.method,
                Jsonb(result.signals),
            ),
        ).fetchone()
        decision_id = row["id"]
        self.connection.execute(
            "delete from public.facility_match_candidates where decision_id = %s",
            (decision_id,),
        )
        for rank, candidate in enumerate(result.candidates, start=1):
            self.connection.execute(
                """
                insert into public.facility_match_candidates (
                  decision_id, facility_id, candidate_rank, match_rule, signals
                ) values (%s, %s, %s, %s, %s)
                """,
                (
                    decision_id,
                    candidate.id,
                    rank,
                    result.method,
                    Jsonb(result.signals),
                ),
            )
        return decision_id, row["status"], str(row["facility_id"]) if row["facility_id"] else None

    def import_star_ratings(self, data_dir: Path, item: dict[str, Any]) -> dict[str, Any]:
        source_file_id = self._source_file(item)
        run_id = self._start_run(source_file_id)
        stats = ImportStats()
        details: dict[str, Any] = {}
        try:
            sheets = read_star_ratings(data_dir)
            source_ids = self._insert_source_records(source_file_id, all_rows(sheets), stats)
            index = self._facility_index()
            nsw_detail = [
                row
                for row in sheets["Detailed data"]
                if row.values["State/Territory"] == "NSW"
            ]
            match_methods = Counter()
            for source in nsw_detail:
                values = source.values
                source_record_id = source_ids[(source.sheet_name, source.row_number)]
                result = index.star(values)
                _, status, facility_id = self._decision(
                    source_file_id=source_file_id,
                    source_record_id=source_record_id,
                    dataset_code="star_ratings",
                    result=result,
                )
                match_methods[result.method] += 1
                if status in ("auto_confirmed", "confirmed") and facility_id:
                    stats.matched_records += 1
                    stats.records_created += self._insert_star_snapshot(
                        facility_id, source_file_id, source_record_id, values
                    )
                    self._add_observed_aliases(
                        facility_id,
                        source_file_id,
                        source_record_id,
                        values["Service Name"],
                        values["Service Suburb"],
                        values["Provider Name"],
                    )
                elif status == "unmatched":
                    stats.unmatched_records += 1
                    self._issue(
                        source_file_id=source_file_id,
                        source_record_id=source_record_id,
                        run_id=run_id,
                        code="star_rating_unmatched",
                        severity="warning",
                        summary="No deterministic Provider Register facility candidate",
                        details=result.signals,
                    )
                else:
                    stats.unresolved_records += 1
                    stats.duplicate_candidates += len(result.candidates)
                    self._issue(
                        source_file_id=source_file_id,
                        source_record_id=source_record_id,
                        run_id=run_id,
                        code="star_rating_match_review",
                        severity="warning",
                        summary="Star Ratings row requires facility match review",
                        details={
                            **result.signals,
                            "candidate_site_ids": [c.site_id for c in result.candidates],
                        },
                    )

            detail_by_identity = {
                (
                    normalize_text(row.values["Service Name"]),
                    normalize_text(row.values["Provider Name"]),
                    normalize_text(row.values["Service Suburb"]),
                ): row
                for row in nsw_detail
            }
            quality_zero_count = 0
            for source in sheets["Star Ratings"]:
                values = source.values
                if values["State/Territory"] != "NSW" or values["Quality Measures rating"] != 0:
                    continue
                identity = (
                    normalize_text(values["Service Name"]),
                    normalize_text(values["Provider Name"]),
                    normalize_text(values["Service Suburb"]),
                )
                detailed = detail_by_identity.get(identity)
                if detailed and detailed.values["Quality Measures rating"] is None:
                    quality_zero_count += 1
                    self._issue(
                        source_file_id=source_file_id,
                        source_record_id=source_ids[(source.sheet_name, source.row_number)],
                        run_id=run_id,
                        code="summary_quality_measure_zero",
                        severity="warning",
                        summary="Summary sheet encodes a missing Quality Measures rating as zero",
                        details={"normalized_value": None, "preferred_sheet": "Detailed data"},
                    )
            details = {
                "nsw_rows": len(nsw_detail),
                "match_methods": dict(sorted(match_methods.items())),
                "summary_quality_measure_zero_values": quality_zero_count,
            }
            self.connection.commit()
        except Exception as error:
            self.connection.rollback()
            stats.error_count += 1
            self._finish_run(run_id, stats, details, error)
            raise
        self._finish_run(run_id, stats, details)
        return {"run_id": run_id, **asdict(stats), **details}

    def _insert_star_snapshot(
        self,
        facility_id: str,
        source_file_id: str,
        source_record_id: int,
        values: dict[str, Any],
    ) -> int:
        reporting_month = datetime.strptime(values["Reporting Period"], "%B %Y").date().replace(day=1)
        re_detail = {
            key: json_value(value) for key, value in values.items() if key.startswith("[RE]")
        }
        compliance_detail = {
            key: json_value(value) for key, value in values.items() if key.startswith("[C]")
        }
        quality_detail = {
            key: json_value(value) for key, value in values.items() if key.startswith("[QM]")
        }
        return max(
            self.connection.execute(
                """
                insert into public.star_rating_snapshots (
                  facility_id, source_file_id, source_record_id, reporting_period,
                  reporting_month, observed_provider_name, purpose,
                  aged_care_planning_region, state, mmm_region, mmm_code,
                  size_band, overall_rating, residents_experience_rating,
                  compliance_rating, staffing_rating, quality_measures_rating,
                  interview_year, rn_minutes_target, rn_minutes_actual,
                  total_minutes_target, total_minutes_actual,
                  residents_experience_detail, compliance_detail,
                  quality_measures_detail
                ) values (
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s
                )
                on conflict do nothing
                """,
                (
                    facility_id,
                    source_file_id,
                    source_record_id,
                    values["Reporting Period"],
                    reporting_month,
                    values["Provider Name"],
                    nullable_text(values["Purpose"]),
                    nullable_text(values["Aged Care Planning Region"]),
                    values["State/Territory"],
                    nullable_text(values["MMM Region"]),
                    nullable_text(values["MMM Code"]),
                    nullable_text(values["Size"]),
                    rating(values["Overall Star Rating"]),
                    rating(values["Residents' Experience rating"]),
                    rating(values["Compliance rating"]),
                    rating(values["Staffing rating"]),
                    rating(values["Quality Measures rating"]),
                    int(values["[RE] Interview Year"]) if values["[RE] Interview Year"] else None,
                    numeric(values["[S] Registered Nurse Care Minutes - Target"]),
                    numeric(values["[S] Registered Nurse Care Minutes - Actual"]),
                    numeric(values["[S] Total Care Minutes - Target"]),
                    numeric(values["[S] Total Care Minutes - Actual"]),
                    Jsonb(re_detail),
                    Jsonb(compliance_detail),
                    Jsonb(quality_detail),
                ),
            ).rowcount,
            0,
        )

    def _add_observed_aliases(
        self,
        facility_id: str,
        source_file_id: str,
        source_record_id: int,
        name: str,
        suburb: str,
        provider_name: str,
    ) -> None:
        self.connection.execute(
            """
            insert into public.facility_aliases (
              facility_id, source_file_id, source_record_id, alias,
              normalized_alias, suburb, normalized_suburb,
              provider_alias, normalized_provider_alias
            ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict do nothing
            """,
            (
                facility_id,
                source_file_id,
                source_record_id,
                name,
                normalize_text(name),
                suburb,
                normalize_text(suburb),
                provider_name,
                normalize_organisation(provider_name),
            ),
        )

    def import_care_minutes(self, data_dir: Path, item: dict[str, Any]) -> dict[str, Any]:
        source_file_id = self._source_file(item)
        run_id = self._start_run(source_file_id)
        stats = ImportStats()
        details: dict[str, Any] = {}
        try:
            sheets = read_care_minutes(data_dir)
            source_ids = self._insert_source_records(source_file_id, all_rows(sheets), stats)
            index = self._facility_index()
            sheet_details = {}
            for sheet_name, rows in sheets.items():
                nsw_rows = [row for row in rows if row.values["State"] == "NSW"]
                raw_hash_counts = Counter(row.hash for row in nsw_rows)
                results = [(source, index.care_minutes(source.values)) for source in nsw_rows]
                seen_facility_period: set[tuple[str, Any]] = set()
                method_counts = Counter()
                accepted = 0
                for source, initial_result in results:
                    values = source.values
                    source_record_id = source_ids[(source.sheet_name, source.row_number)]
                    result = initial_result
                    if result.status == "auto_confirmed" and result.facility:
                        key = (result.facility.id, CARE_PERIODS[sheet_name][0])
                        if key in seen_facility_period:
                            result = MatchResult(
                                status="review_required",
                                method="duplicate_period_observation",
                                facility=None,
                                candidates=(initial_result.facility,),
                                signals={
                                    **initial_result.signals,
                                    "original_match_method": initial_result.method,
                                },
                            )
                        else:
                            seen_facility_period.add(key)
                    method_counts[result.method] += 1
                    _, status, facility_id = self._decision(
                        source_file_id=source_file_id,
                        source_record_id=source_record_id,
                        dataset_code="care_minutes",
                        result=result,
                    )
                    if raw_hash_counts[source.hash] > 1:
                        stats.duplicate_candidates += 1
                        self._issue(
                            source_file_id=source_file_id,
                            source_record_id=source_record_id,
                            run_id=run_id,
                            code="duplicate_source_row",
                            severity="warning",
                            summary="This care-minutes row is identical to another physical source row",
                            details={"sheet": sheet_name, "row_hash": source.hash},
                        )
                    if status in ("auto_confirmed", "confirmed") and facility_id:
                        accepted += 1
                        stats.matched_records += 1
                        stats.records_created += self._insert_care_snapshot(
                            facility_id,
                            source_file_id,
                            source_record_id,
                            sheet_name,
                            values,
                        )
                        self._add_observed_aliases(
                            facility_id,
                            source_file_id,
                            source_record_id,
                            values["Home Name"],
                            values["Suburb"],
                            values["Provider Name"],
                        )
                        if result.signals.get("provider_alias_agrees") is False:
                            self._issue(
                                source_file_id=source_file_id,
                                source_record_id=source_record_id,
                                run_id=run_id,
                                code="observed_provider_differs",
                                severity="info",
                                summary="Observed provider label differs from the current register provider",
                                details=result.signals,
                                entity_type="facility",
                                entity_id=facility_id,
                            )
                    elif status == "unmatched":
                        stats.unmatched_records += 1
                        self._issue(
                            source_file_id=source_file_id,
                            source_record_id=source_record_id,
                            run_id=run_id,
                            code="care_minutes_unmatched",
                            severity="warning",
                            summary="No deterministic Provider Register facility candidate",
                            details=result.signals,
                        )
                    else:
                        stats.unresolved_records += 1
                        stats.duplicate_candidates += len(result.candidates)
                        self._issue(
                            source_file_id=source_file_id,
                            source_record_id=source_record_id,
                            run_id=run_id,
                            code="care_minutes_match_review",
                            severity="warning",
                            summary="Care Minutes row requires facility match review",
                            details={
                                **result.signals,
                                "candidate_site_ids": [c.site_id for c in result.candidates],
                            },
                        )
                    self._validate_care_formula(
                        source_file_id, source_record_id, run_id, values, stats
                    )
                sheet_details[sheet_name] = {
                    "nsw_rows": len(nsw_rows),
                    "accepted_snapshots": accepted,
                    "match_methods": dict(sorted(method_counts.items())),
                    "exact_duplicate_rows": sum(
                        count for count in raw_hash_counts.values() if count > 1
                    ),
                }
            details = {"sheets": sheet_details}
            self.connection.commit()
        except Exception as error:
            self.connection.rollback()
            stats.error_count += 1
            self._finish_run(run_id, stats, details, error)
            raise
        self._finish_run(run_id, stats, details)
        return {"run_id": run_id, **asdict(stats), **details}

    def _insert_care_snapshot(
        self,
        facility_id: str,
        source_file_id: str,
        source_record_id: int,
        sheet_name: str,
        values: dict[str, Any],
    ) -> int:
        period_start, period_end = CARE_PERIODS[sheet_name]
        return max(
            self.connection.execute(
                """
                insert into public.care_minutes_snapshots (
                  facility_id, source_file_id, source_record_id, period_start,
                  period_end, observed_home_name, observed_provider_name,
                  home_size_band, suburb, mmm_location, state, longitude,
                  latitude, address, total_minutes_target, total_minutes_actual,
                  total_target_percentage, rn_minutes_target, rn_performance,
                  rn_target_percentage, met_responsibility, rn_minutes_actual,
                  en_minutes_actual
                ) values (
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                  %s, %s, %s
                )
                on conflict do nothing
                """,
                (
                    facility_id,
                    source_file_id,
                    source_record_id,
                    period_start,
                    period_end,
                    values["Home Name"],
                    values["Provider Name"],
                    nullable_text(column_starting_with(values, "Home Size")),
                    nullable_text(values["Suburb"]),
                    int(values["MMM Location"]),
                    values["State"],
                    numeric(values["Longitude"]),
                    numeric(values["Latitude"]),
                    nullable_text(values["Address"]),
                    numeric(values["Total Direct Care Minutes Target"]),
                    numeric(values["Actual Total Direct Care Minutes Delivered"]),
                    numeric(values["% of total care minutes target delivered"]),
                    numeric(values["RN Minutes Target"]),
                    numeric(values["Actual RN Performance*"]),
                    numeric(values["% of RN target delivered"]),
                    yes_no(values["Met care minutes responsibility (Yes/No)"]),
                    numeric(values["Actual RN Minutes Delivered"]),
                    numeric(values["Actual EN Minutes Delivered"]),
                ),
            ).rowcount,
            0,
        )

    def _validate_care_formula(
        self,
        source_file_id: str,
        source_record_id: int,
        run_id: str,
        values: dict[str, Any],
        stats: ImportStats,
    ) -> None:
        total_target = numeric(values["Total Direct Care Minutes Target"])
        total_actual = numeric(values["Actual Total Direct Care Minutes Delivered"])
        total_pct = numeric(values["% of total care minutes target delivered"])
        rn_target = numeric(values["RN Minutes Target"])
        rn_performance = numeric(values["Actual RN Performance*"])
        rn_pct = numeric(values["% of RN target delivered"])
        rn_actual = numeric(values["Actual RN Minutes Delivered"])
        en_actual = numeric(values["Actual EN Minutes Delivered"])
        responsibility = yes_no(values["Met care minutes responsibility (Yes/No)"])
        if None in (
            total_target,
            total_actual,
            total_pct,
            rn_target,
            rn_performance,
            rn_pct,
            rn_actual,
            en_actual,
            responsibility,
        ) or total_target <= 0 or rn_target <= 0:
            stats.error_count += 1
            self._issue(
                source_file_id=source_file_id,
                source_record_id=source_record_id,
                run_id=run_id,
                code="care_minutes_missing_metric",
                severity="error",
                summary="Required Care Minutes metric is missing",
                details={},
            )
            return
        total_delta = abs((total_actual / total_target * 100) - total_pct)
        rn_delta = abs((rn_performance / rn_target * 100) - rn_pct)
        performance_delta = abs(
            (rn_actual + min(en_actual, rn_target * 0.1)) - rn_performance
        )
        expected_responsibility = total_pct >= 100 and rn_pct >= 100
        if (
            total_delta > 0.011
            or rn_delta > 0.011
            or performance_delta > 0.011
            or responsibility is not expected_responsibility
        ):
            stats.error_count += 1
            self._issue(
                source_file_id=source_file_id,
                source_record_id=source_record_id,
                run_id=run_id,
                code="care_minutes_formula_mismatch",
                severity="error",
                summary="Published care-minutes metrics do not reconcile",
                details={
                    "total_delta": total_delta,
                    "rn_delta": rn_delta,
                    "performance_delta": performance_delta,
                    "reported_responsibility": responsibility,
                    "expected_responsibility": expected_responsibility,
                },
            )
