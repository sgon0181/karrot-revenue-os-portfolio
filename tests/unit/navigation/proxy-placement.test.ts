import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("places the auth proxy beside src/app so Next executes it", () => {
  assert.equal(existsSync("src/proxy.ts"), true);
  assert.equal(existsSync("proxy.ts"), false);

  const proxySource = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxySource, /export async function proxy/);
  assert.match(proxySource, /return updateSession\(request\)/);
});
