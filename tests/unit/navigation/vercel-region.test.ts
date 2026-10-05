import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function applicationSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return applicationSourceFiles(path);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

test("Vercel runs every application function in Sydney", () => {
  const config = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
  assert.equal(config.$schema, "https://openapi.vercel.sh/vercel.json");
  assert.deepEqual(config.regions, ["syd1"]);
  assert.equal(Object.hasOwn(config, "functions"), false);
  assert.equal(existsSync(join(root, "vercel.ts")), false);
});

test("App Router routes do not reintroduce deprecated region exports", () => {
  const deprecatedExports = applicationSourceFiles(join(root, "src/app"))
    .filter((path) =>
      /export\s+const\s+preferredRegion\b/.test(readFileSync(path, "utf8")),
    )
    .map((path) => relative(root, path));
  assert.deepEqual(deprecatedExports, []);
});
