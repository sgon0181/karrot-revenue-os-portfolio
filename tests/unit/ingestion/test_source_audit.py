from pathlib import Path

import pytest

from karrot_ingestion.audit import audit_failures, audit_sources
from karrot_ingestion.database import validate_archival_change


ROOT = Path(__file__).resolve().parents[3]


def test_authoritative_workbook_reconciliation():
    audit = audit_sources(ROOT)
    register = audit["provider_register"]
    assert register["nsw_homes"] == 926
    assert register["nsw_site_ids"] == 926
    assert register["nsw_providers_by_abn"] == 237
    assert register["duplicate_site_ids"] == 0

    ratings = audit["star_ratings"]
    assert ratings["nsw_rows"] == 823
    assert ratings["match_statuses"] == {
        "auto_confirmed": 821,
        "review_required": 2,
    }
    assert ratings["summary_quality_measure_zero_values"] == 27

    care = audit["care_minutes"]
    assert [care[period]["nsw_rows"] for period in care] == [794, 818, 813]
    assert all(period["formula_validation_errors"] == 0 for period in care.values())
    assert audit_failures(audit) == []


def test_audit_gate_rejects_non_reconciling_care_metrics():
    audit = audit_sources(ROOT)
    audit["care_minutes"]["Jan-Mar 2026"]["formula_validation_errors"] = 1
    assert audit_failures(audit) == [
        "Jan-Mar 2026 contains 1 care-minute formula errors"
    ]


def test_archival_change_guard_accepts_small_authoritative_delta():
    validate_archival_change("facilities", 926, 5, 0.10)
    validate_archival_change("providers", 237, 0, 0.10)


def test_archival_change_guard_rejects_suspicious_source_contraction():
    with pytest.raises(ValueError, match="Refusing to archive 101 of 926 active facilities"):
        validate_archival_change("facilities", 926, 101, 0.10)
