from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Iterable

from .normalization import normalize_address, normalize_organisation, normalize_text


@dataclass(frozen=True)
class FacilityRef:
    id: str
    site_id: str
    provider_id: str
    provider_abn: str
    name: str
    suburb: str
    address: str
    provider_aliases: frozenset[str]

    @property
    def name_suburb_key(self) -> tuple[str, str]:
        return normalize_text(self.name), normalize_text(self.suburb)

    @property
    def address_key(self) -> str:
        return normalize_address(self.address)


@dataclass(frozen=True)
class MatchResult:
    status: str
    method: str
    facility: FacilityRef | None
    candidates: tuple[FacilityRef, ...]
    signals: dict[str, Any]


class FacilityIndex:
    def __init__(self, facilities: Iterable[FacilityRef]):
        self.facilities = tuple(facilities)
        self.by_name_suburb: dict[tuple[str, str], list[FacilityRef]] = defaultdict(list)
        self.by_address: dict[str, list[FacilityRef]] = defaultdict(list)
        for facility in self.facilities:
            self.by_name_suburb[facility.name_suburb_key].append(facility)
            self.by_address[facility.address_key].append(facility)

    def star(self, row: dict[str, Any]) -> MatchResult:
        provider_alias = normalize_organisation(row.get("Provider Name"))
        key = (normalize_text(row.get("Service Name")), normalize_text(row.get("Service Suburb")))
        candidates = tuple(self.by_name_suburb.get(key, ()))
        provider_candidates = tuple(
            candidate
            for candidate in candidates
            if provider_alias in candidate.provider_aliases
        )
        signals = {
            "normalized_name": key[0],
            "normalized_suburb": key[1],
            "normalized_provider": provider_alias,
            "name_suburb_candidate_count": len(candidates),
            "provider_filtered_candidate_count": len(provider_candidates),
        }
        if len(provider_candidates) == 1:
            return MatchResult(
                "auto_confirmed",
                "exact_name_suburb_provider_alias",
                provider_candidates[0],
                candidates,
                signals,
            )
        if len(candidates) == 1:
            return MatchResult(
                "review_required",
                "unique_name_suburb_provider_conflict",
                None,
                candidates,
                signals,
            )
        if candidates:
            return MatchResult(
                "review_required",
                "ambiguous_name_suburb",
                None,
                candidates,
                signals,
            )
        return MatchResult("unmatched", "no_deterministic_candidate", None, (), signals)

    def care_minutes(self, row: dict[str, Any]) -> MatchResult:
        provider_alias = normalize_organisation(row.get("Provider Name"))
        name_key = (normalize_text(row.get("Home Name")), normalize_text(row.get("Suburb")))
        address_key = normalize_address(row.get("Address"))
        name_candidates = tuple(self.by_name_suburb.get(name_key, ()))
        address_candidates = tuple(self.by_address.get(address_key, ()))
        address_ids = {candidate.id for candidate in address_candidates}
        address_provider_candidates = tuple(
            candidate
            for candidate in address_candidates
            if provider_alias in candidate.provider_aliases
        )
        signals = {
            "normalized_name": name_key[0],
            "normalized_suburb": name_key[1],
            "normalized_address": address_key,
            "normalized_provider": provider_alias,
            "name_suburb_candidate_count": len(name_candidates),
            "address_candidate_count": len(address_candidates),
            "address_provider_candidate_count": len(address_provider_candidates),
        }

        if len(name_candidates) == 1:
            candidate = name_candidates[0]
            if address_candidates and candidate.id not in address_ids:
                combined = _dedupe((*name_candidates, *address_candidates))
                return MatchResult(
                    "review_required",
                    "name_address_conflict",
                    None,
                    combined,
                    signals,
                )
            signals["provider_alias_agrees"] = provider_alias in candidate.provider_aliases
            return MatchResult(
                "auto_confirmed",
                "exact_unique_name_suburb",
                candidate,
                name_candidates,
                signals,
            )

        if len(address_provider_candidates) == 1:
            return MatchResult(
                "auto_confirmed",
                "exact_unique_address_provider_alias",
                address_provider_candidates[0],
                address_candidates,
                signals,
            )

        intersection = tuple(
            candidate for candidate in name_candidates if candidate.id in address_ids
        )
        if len(intersection) == 1 and provider_alias in intersection[0].provider_aliases:
            return MatchResult(
                "auto_confirmed",
                "unique_candidate_intersection",
                intersection[0],
                _dedupe((*name_candidates, *address_candidates)),
                signals,
            )

        if len(address_candidates) == 1:
            return MatchResult(
                "review_required",
                "unique_address_only",
                None,
                address_candidates,
                signals,
            )

        combined = _dedupe((*name_candidates, *address_candidates))
        if combined:
            return MatchResult(
                "review_required",
                "ambiguous_deterministic_candidates",
                None,
                combined,
                signals,
            )
        return MatchResult("unmatched", "no_deterministic_candidate", None, (), signals)


def _dedupe(candidates: Iterable[FacilityRef]) -> tuple[FacilityRef, ...]:
    result = {}
    for candidate in candidates:
        result[candidate.id] = candidate
    return tuple(sorted(result.values(), key=lambda candidate: candidate.site_id))
