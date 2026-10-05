# Publication verification

Validated locally on 6 October 2026 against the curated public snapshot:

- 166 JavaScript/TypeScript tests passed, with lint and typecheck included.
- Production build passed.
- Seven Python normalization and matching tests passed.
- Next.js and its ESLint configuration were updated to 16.3.8 after the dependency audit found critical runtime advisories in the original lockfile.
- `npm audit --omit=dev` reported zero vulnerabilities after the update.
- The full dependency audit still reports five high-severity findings in the development-only ESLint/fast-glob/micromatch/braces chain. The suggested automatic fix downgrades Next.js ESLint configuration across major versions and was not applied. Do not expose development tooling to untrusted users or treat this as a deployment clearance.

The public test boundary excludes workbook reconciliation, since the original data files are not redistributed. Live research, production deployment, database restore and full database integration are not established by unit checks.

The optional sample SQL was reviewed against the migration schema but was not executed against a fresh Supabase stack in this publication pass.
