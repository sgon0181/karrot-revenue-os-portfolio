import assert from "node:assert/strict";
import test from "node:test";
import {
  googleMapsLocationUrl,
// Node's built-in type stripping requires the extension; the production
// TypeScript configuration intentionally does not enable TS extension imports.
// @ts-expect-error exercised directly with `node --experimental-strip-types --test`
} from "../../../src/features/market/lib/maps.ts";

test("facility map links prefer exact coordinates and retain address fallback", () => {
  const exact = new URL(googleMapsLocationUrl({
    address: "Bennelong Point, Sydney NSW 2000",
    latitude: -33.8566674153,
    longitude: 151.215221336,
  }));
  assert.equal(exact.searchParams.get("query"), "-33.8566674153,151.215221336");

  const fallback = new URL(googleMapsLocationUrl({
    address: "36 Dangar Street, Randwick NSW 2031",
    latitude: null,
    longitude: null,
  }));
  assert.equal(fallback.searchParams.get("query"), "36 Dangar Street, Randwick NSW 2031");
});
