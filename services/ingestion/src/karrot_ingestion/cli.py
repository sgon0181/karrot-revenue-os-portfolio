from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from . import __version__
from .audit import audit_failures, audit_sources


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Karrot Revenue OS data pipeline")
    subcommands = result.add_subparsers(dest="command", required=True)
    audit = subcommands.add_parser(
        "audit", help="Inspect and reconcile the three source workbooks"
    )
    audit.add_argument("--data-dir", type=Path, default=Path.cwd())
    import_all = subcommands.add_parser(
        "import-all", help="Idempotently import all sources into Postgres"
    )
    import_all.add_argument("--data-dir", type=Path, default=Path.cwd())
    return result


def main() -> None:
    args = parser().parse_args()
    data_dir = args.data_dir.resolve()
    if args.command == "audit":
        report = audit_sources(data_dir)
        print(json.dumps(report, indent=2, default=str))
        failures = audit_failures(report)
        if failures:
            raise SystemExit("Source audit failed:\n- " + "\n- ".join(failures))
        return

    from dotenv import load_dotenv

    load_dotenv(data_dir / ".env.local")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required for import-all; keep it in .env.local")
    from .database import RevenueDatabase

    database = RevenueDatabase(database_url, importer_version=__version__)
    try:
        print(json.dumps(database.import_all(data_dir), indent=2, default=str))
    finally:
        database.close()


if __name__ == "__main__":
    main()
