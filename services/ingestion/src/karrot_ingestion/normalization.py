from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal
from typing import Any


LEGAL_SUFFIXES = {
    "PTY",
    "LTD",
    "LIMITED",
    "INC",
    "INCORPORATED",
    "CORPORATION",
    "CORP",
}

ADDRESS_REPLACEMENTS = {
    "STREET": "ST",
    "ROAD": "RD",
    "AVENUE": "AVE",
    "DRIVE": "DR",
    "CRESCENT": "CRES",
    "PLACE": "PL",
    "HIGHWAY": "HWY",
    "PARADE": "PDE",
    "CIRCUIT": "CCT",
    "TERRACE": "TCE",
    "BOULEVARD": "BLVD",
}


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.upper().replace("&", " AND ")
    text = text.replace("'", "").replace("’", "").replace("`", "")
    return re.sub(r"[^A-Z0-9]+", " ", text).strip()


def normalize_organisation(value: Any) -> str:
    tokens = normalize_text(value).split()
    while tokens and tokens[-1] in LEGAL_SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


def normalize_address(value: Any) -> str:
    tokens = normalize_text(value).split()
    return " ".join(ADDRESS_REPLACEMENTS.get(token, token) for token in tokens)


def abn_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    digits = re.sub(r"\D", "", str(value))
    return digits.zfill(11) if digits else ""


def postcode_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    digits = re.sub(r"\D", "", str(value))
    return digits.zfill(4) if digits else ""


def json_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, float) and value != value:
        return None
    return value


def stable_json(payload: dict[str, Any]) -> str:
    cleaned = {key: json_value(value) for key, value in payload.items()}
    return json.dumps(cleaned, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def row_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(stable_json(payload).encode("utf-8")).hexdigest()


def split_semicolon(value: Any) -> list[str]:
    if value is None:
        return []
    return [item.strip() for item in str(value).split(";") if item.strip()]


def nullable_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def numeric(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def integer(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def rating(value: Any) -> int | None:
    parsed = integer(value)
    if parsed in (None, 0):
        return None
    if not 1 <= parsed <= 5:
        raise ValueError(f"Rating outside 1..5: {value!r}")
    return parsed


def yes_no(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    normalized = normalize_text(value)
    if normalized == "YES":
        return True
    if normalized == "NO":
        return False
    raise ValueError(f"Expected Yes/No value, received {value!r}")
