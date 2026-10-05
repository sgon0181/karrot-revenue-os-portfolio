from karrot_ingestion.matching import FacilityIndex, FacilityRef
from karrot_ingestion.normalization import normalize_organisation


def facility(
    site_id: str,
    name: str,
    suburb: str,
    address: str,
    provider: str = "Example Care Pty Ltd",
) -> FacilityRef:
    return FacilityRef(
        id=site_id,
        site_id=site_id,
        provider_id=f"provider-{site_id}",
        provider_abn="12345678901",
        name=name,
        suburb=suburb,
        address=address,
        provider_aliases=frozenset({normalize_organisation(provider)}),
    )


def test_star_auto_matches_only_a_unique_provider_supported_candidate():
    index = FacilityIndex(
        [facility("ARCH-00001", "Example House", "SYDNEY", "1 Main Street, Sydney NSW 2000")]
    )
    result = index.star(
        {
            "Service Name": "Example House",
            "Service Suburb": "Sydney",
            "Provider Name": "Example Care Limited",
        }
    )
    assert result.status == "auto_confirmed"
    assert result.facility.site_id == "ARCH-00001"


def test_crowley_shape_remains_reviewable():
    index = FacilityIndex(
        [
            facility(
                "ARCH-04218",
                "Crowley Retirement Village",
                "BALLINA",
                "154 Cherry Street, Ballina NSW 2478",
            ),
            facility(
                "ARCH-04220",
                "Crowley Retirement Village",
                "BALLINA",
                "154 Cherry Street, Ballina NSW 2478",
            ),
        ]
    )
    row = {
        "Service Name": "Crowley Retirement Village",
        "Service Suburb": "BALLINA",
        "Provider Name": "Example Care Pty Ltd",
    }
    result = index.star(row)
    assert result.status == "review_required"
    assert {candidate.site_id for candidate in result.candidates} == {
        "ARCH-04218",
        "ARCH-04220",
    }


def test_unique_address_without_provider_support_is_not_auto_confirmed():
    index = FacilityIndex(
        [facility("ARCH-00001", "Canonical Home", "SYDNEY", "1 Main Street, Sydney NSW 2000")]
    )
    result = index.care_minutes(
        {
            "Home Name": "Truncated Hom",
            "Suburb": "SYDNEY",
            "Address": "1 Main Street, Sydney NSW 2000",
            "Provider Name": "Different Operator",
        }
    )
    assert result.status == "review_required"
    assert result.method == "unique_address_only"
