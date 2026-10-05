from karrot_ingestion.normalization import (
    abn_text,
    normalize_address,
    normalize_organisation,
    normalize_text,
    postcode_text,
    rating,
)


def test_identifiers_are_preserved_as_padded_text():
    assert abn_text(123456789) == "00123456789"
    assert postcode_text(800) == "0800"


def test_organisation_normalization_removes_only_legal_suffixes():
    assert normalize_organisation("Example Care Pty. Ltd.") == "EXAMPLE CARE"
    assert normalize_organisation("The Uniting Church in Australia") == (
        "THE UNITING CHURCH IN AUSTRALIA"
    )


def test_address_and_text_normalization_are_deterministic():
    assert normalize_text("St Vincent’s – Auburn") == "ST VINCENTS AUBURN"
    assert normalize_address("12 Example Street, Sydney NSW 2000") == (
        "12 EXAMPLE ST SYDNEY NSW 2000"
    )


def test_zero_rating_is_missing_not_a_star():
    assert rating(0) is None
    assert rating(None) is None
    assert rating(5) == 5
