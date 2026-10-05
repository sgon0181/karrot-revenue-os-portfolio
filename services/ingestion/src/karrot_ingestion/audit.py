from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

from .matching import FacilityIndex, FacilityRef
from .normalization import (
    abn_text,
    normalize_address,
    normalize_organisation,
    normalize_text,
    numeric,
    row_hash,
    yes_no,
)
from .workbooks import (
    CARE_PERIODS,
    all_rows,
    load_manifest,
    read_care_minutes,
    read_provider_register,
    read_star_ratings,
    validate_manifest_files,
)


def build_facility_index(provider_sheets) -> FacilityIndex:
    providers = {
        abn_text(row.values["ABN"]): row.values
        for row in provider_sheets["Provider Details"]
    }
    facilities = []
    for row in provider_sheets["Residential Care Home Details"]:
        values = row.values
        if values["Residential Care Home State"] != "New South Wales":
            continue
        abn = abn_text(values["ABN"])
        provider = providers[abn]
        aliases = frozenset(
            {
                normalize_organisation(provider["Entity Name"]),
                normalize_organisation(provider["Business Name"]),
                normalize_organisation(values["Entity Name"]),
                normalize_organisation(values["Business Name"]),
            }
        )
        site_id = str(values["Site ID"])
        facilities.append(
            FacilityRef(
                id=site_id,
                site_id=site_id,
                provider_id=abn,
                provider_abn=abn,
                name=str(values["Name Of Each Home"]),
                suburb=str(values["Residential Care Home Suburb"]),
                address=str(values["Residential Care Home Full Address"]),
                provider_aliases=aliases,
            )
        )
    return FacilityIndex(facilities)


def audit_sources(data_dir: Path) -> dict[str, Any]:
    manifest = load_manifest(data_dir)
    validate_manifest_files(data_dir, manifest)
    provider_sheets = read_provider_register(data_dir)
    star_sheets = read_star_ratings(data_dir)
    care_sheets = read_care_minutes(data_dir)
    facility_index = build_facility_index(provider_sheets)

    nsw_homes = [
        row
        for row in provider_sheets["Residential Care Home Details"]
        if row.values["Residential Care Home State"] == "New South Wales"
    ]
    nsw_abns = {abn_text(row.values["ABN"]) for row in nsw_homes}
    site_ids = [str(row.values["Site ID"]) for row in nsw_homes]
    addresses = Counter(
        normalize_address(row.values["Residential Care Home Full Address"])
        for row in nsw_homes
    )

    star_rows = [
        row
        for row in star_sheets["Detailed data"]
        if row.values["State/Territory"] == "NSW"
    ]
    star_matches = [facility_index.star(row.values) for row in star_rows]
    star_statuses = Counter(result.status for result in star_matches)
    star_methods = Counter(result.method for result in star_matches)

    rating_columns = [
        "Overall Star Rating",
        "Residents' Experience rating",
        "Compliance rating",
        "Staffing rating",
        "Quality Measures rating",
    ]
    rating_nulls = {
        column: sum(row.values[column] is None for row in star_rows)
        for column in rating_columns
    }

    care_results = {}
    for sheet_name, rows in care_sheets.items():
        nsw_rows = [row for row in rows if row.values["State"] == "NSW"]
        matches = [facility_index.care_minutes(row.values) for row in nsw_rows]
        duplicate_groups = Counter(row.hash for row in nsw_rows)
        formula_errors = 0
        for row in rows:
            values = row.values
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
                formula_errors += 1
                continue
            expected_rn_performance = rn_actual + min(en_actual, rn_target * 0.1)
            expected_responsibility = total_pct >= 100 and rn_pct >= 100
            if any(
                (
                    abs((total_actual / total_target * 100) - total_pct) > 0.011,
                    abs((rn_performance / rn_target * 100) - rn_pct) > 0.011,
                    abs(expected_rn_performance - rn_performance) > 0.011,
                    responsibility is not expected_responsibility,
                )
            ):
                formula_errors += 1
        care_results[sheet_name] = {
            "period_start": CARE_PERIODS[sheet_name][0].isoformat(),
            "period_end": CARE_PERIODS[sheet_name][1].isoformat(),
            "national_rows": len(rows),
            "nsw_rows": len(nsw_rows),
            "match_statuses": dict(sorted(Counter(result.status for result in matches).items())),
            "match_methods": dict(sorted(Counter(result.method for result in matches).items())),
            "exact_duplicate_rows": sum(count for count in duplicate_groups.values() if count > 1),
            "exact_duplicate_groups": sum(1 for count in duplicate_groups.values() if count > 1),
            "formula_validation_errors": formula_errors,
        }

    summary_rows = [
        row
        for row in star_sheets["Star Ratings"]
        if row.values["State/Territory"] == "NSW"
    ]
    summary_qm_zero = sum(row.values["Quality Measures rating"] == 0 for row in summary_rows)

    return {
        "scope": "NSW approved residential care homes, filtered by home state",
        "files": {
            code: {
                "file_name": item["file_name"],
                "sha256": item["sha256"],
                "schema_version": item["schema_version"],
            }
            for code, item in manifest.items()
        },
        "provider_register": {
            "sheet_rows": {name: len(rows) for name, rows in provider_sheets.items()},
            "nsw_homes": len(nsw_homes),
            "nsw_site_ids": len(set(site_ids)),
            "nsw_providers_by_abn": len(nsw_abns),
            "duplicate_site_ids": len(site_ids) - len(set(site_ids)),
            "multi_home_address_groups": sum(1 for count in addresses.values() if count > 1),
            "multi_home_address_rows": sum(count for count in addresses.values() if count > 1),
        },
        "star_ratings": {
            "national_rows": len(star_sheets["Detailed data"]),
            "nsw_rows": len(star_rows),
            "match_statuses": dict(sorted(star_statuses.items())),
            "match_methods": dict(sorted(star_methods.items())),
            "rating_nulls_detailed": rating_nulls,
            "summary_quality_measure_zero_values": summary_qm_zero,
        },
        "care_minutes": care_results,
    }


def audit_failures(report: dict[str, Any]) -> list[str]:
    """Return invariant violations that make the source audit unsafe to accept."""
    failures: list[str] = []
    register = report["provider_register"]
    if register["duplicate_site_ids"]:
        failures.append(
            f"Provider Register contains {register['duplicate_site_ids']} duplicate NSW Site IDs"
        )
    if register["nsw_homes"] != register["nsw_site_ids"]:
        failures.append("NSW home rows do not reconcile to distinct Site IDs")

    ratings = report["star_ratings"]
    if sum(ratings["match_statuses"].values()) != ratings["nsw_rows"]:
        failures.append("Star Ratings match outcomes do not reconcile to NSW rows")

    for period, result in report["care_minutes"].items():
        if sum(result["match_statuses"].values()) != result["nsw_rows"]:
            failures.append(f"{period} match outcomes do not reconcile to NSW rows")
        if result["formula_validation_errors"]:
            failures.append(
                f"{period} contains {result['formula_validation_errors']} care-minute formula errors"
            )
    return failures
