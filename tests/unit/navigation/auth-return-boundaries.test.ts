import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  DEFAULT_INTERNAL_PATH,
  RETURN_TO_PARAM,
  safeSingleInternalPath,
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
} from "../../../src/shared/lib/internal-navigation.ts";

const root = resolve(import.meta.dirname, "../../..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("proxy, login page, and login action all require one returnTo value", () => {
  const proxy = source("src/infrastructure/supabase/proxy.ts");
  const page = source("src/app/login/page.tsx");
  const action = source("src/app/actions/auth.ts");

  assert.match(
    proxy,
    /safeSingleInternalPath\(\s*request\.nextUrl\.searchParams\.getAll\(RETURN_TO_PARAM\)/,
  );
  assert.doesNotMatch(proxy, /searchParams\.get\(["']returnTo["']\)/);
  assert.match(page, /Array\.isArray\(params\.returnTo\)/);
  assert.match(page, /safeSingleInternalPath\(returnToValues\)/);
  assert.match(
    action,
    /safeSingleInternalPath\(formData\.getAll\(RETURN_TO_PARAM\)\)/,
  );
  assert.doesNotMatch(action, /formData\.get\(["']returnTo["']\)/);
});

test("safe-first, unsafe-first, identical, and malformed duplicate values fail closed", () => {
  const cases = [
    new URLSearchParams(`${RETURN_TO_PARAM}=%2Ftasks&${RETURN_TO_PARAM}=%2F%2Fevil.example`),
    new URLSearchParams(`${RETURN_TO_PARAM}=%2F%2Fevil.example&${RETURN_TO_PARAM}=%2Ftasks`),
    new URLSearchParams(`${RETURN_TO_PARAM}=%2Ftasks&${RETURN_TO_PARAM}=%2Ftasks`),
    new URLSearchParams(`${RETURN_TO_PARAM}=%25GG&${RETURN_TO_PARAM}=%2Ftasks`),
  ];

  for (const params of cases) {
    assert.equal(
      safeSingleInternalPath(params.getAll(RETURN_TO_PARAM)),
      DEFAULT_INTERNAL_PATH,
    );
  }
});
