import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");
const sourceRoot = join(root, "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("centralises authenticated application identity and role lookup", () => {
  const files = sourceFiles(sourceRoot);
  const directSessionReaders = files
    .filter((path) => /\.auth\.(?:getUser|getSession)\s*\(/.test(readFileSync(path, "utf8")))
    .map((path) => relative(root, path));
  assert.deepEqual(directSessionReaders, []);

  const roleReaders = files
    .filter((path) => /\.from\(["']profiles["']\)[\s\S]{0,160}\.select\(["']role["']\)/.test(readFileSync(path, "utf8")))
    .map((path) => relative(root, path));
  assert.deepEqual(roleReaders, ["src/infrastructure/supabase/auth.ts"]);

  const principalSource = readSource("src/infrastructure/supabase/auth.ts");
  assert.match(principalSource, /getAuthenticatedPrincipal\s*=\s*cache\(async\s*\(\)\s*=>/);
  assert.match(principalSource, /supabase\.auth\.getClaims\(\)/);
  assert.match(principalSource, /role:\s*profile\?\.role\s*\?\?\s*"viewer"/);
});

test("role-sensitive pages and commands derive access from the shared principal", () => {
  for (const path of [
    "src/app/(app)/tasks/page.tsx",
    "src/app/(app)/pipeline/page.tsx",
    "src/app/(app)/visits/page.tsx",
    "src/app/(app)/opportunities/[id]/page.tsx",
    "src/features/accounts/server/actions/context.ts",
    "src/features/intelligence/server/action-context.ts",
    "src/features/data-health/server/actions.ts",
    "src/features/data-health/server/load-data-health.ts",
    "src/features/visits/server/actions.ts",
  ]) {
    const source = readSource(path);
    assert.match(source, /getAuthenticatedPrincipal\(\)/, `${path} must use the shared principal`);
    assert.doesNotMatch(source, /\.auth\.(?:getUser|getSession)\s*\(/);
    assert.doesNotMatch(source, /\.select\(["']role["']\)/);
  }

  for (const moduleName of [
    "contacts",
    "opportunities",
    "activities",
    "next-actions",
    "customers",
  ]) {
    const path = `src/features/accounts/server/actions/${moduleName}.ts`;
    const source = readSource(path);
    assert.match(source, /await accountActionContext\(\)/, `${path} must use the shared action context`);
    assert.doesNotMatch(source, /getAuthenticatedPrincipal\(\)/);
    assert.doesNotMatch(source, /\.auth\.(?:getUser|getSession)\s*\(/);
    assert.doesNotMatch(source, /\.select\(["']role["']\)/);
  }

  const intelligenceActions = readSource(
    "src/features/intelligence/server/actions.ts",
  );
  assert.match(intelligenceActions, /await intelligenceActionContext\(\)/);
  assert.doesNotMatch(intelligenceActions, /getAuthenticatedPrincipal\(\)/);
  assert.doesNotMatch(intelligenceActions, /\.auth\.(?:getUser|getSession)\s*\(/);
  assert.doesNotMatch(intelligenceActions, /\.select\(["']role["']\)/);

  for (const path of [
    "src/app/(app)/tasks/page.tsx",
    "src/app/(app)/pipeline/page.tsx",
    "src/app/(app)/visits/page.tsx",
    "src/app/(app)/opportunities/[id]/page.tsx",
    "src/features/data-health/server/actions.ts",
    "src/features/data-health/server/load-data-health.ts",
    "src/features/visits/server/actions.ts",
  ]) {
    const source = readSource(path);
    assert.match(source, /principal\.role/);
  }

  const dataHealthActions = readSource("src/features/data-health/server/actions.ts");
  assert.match(dataHealthActions, /principal\.role\s*!==\s*"owner"\s*&&\s*principal\.role\s*!==\s*"editor"/);
  assert.match(dataHealthActions, /principal\.role\s*!==\s*"owner"/);

  const visitActions = readSource("src/features/visits/server/actions.ts");
  assert.match(visitActions, /principal\.role\s*!==\s*"owner"\s*&&\s*principal\.role\s*!==\s*"editor"/);
});
