# Test map

```text
unit/ingestion/       Python tests for source audit, normalisation and matching
integration/database Transactional PostgreSQL/RLS/lifecycle verification
```

Application gates are defined in `.github/workflows/ci.yml` and exposed through `package.json`.

```bash
npm test
python -m pytest
npm run data:audit
npm run build
```

Hosted browser acceptance is recorded in `docs/operations/verification.md`. A committed automated browser suite remains a future hardening item.
