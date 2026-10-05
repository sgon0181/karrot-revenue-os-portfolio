import assert from "node:assert/strict";
import test from "node:test";
import {
  normaliseSearchQuery,
  searchPattern,
  searchResultHref,
} from "../../src/app/(app)/search/search-helpers.ts";

test("normalises wildcard punctuation without producing a match-all pattern", () => {
  assert.equal(normaliseSearchQuery("  Montefiore, Randwick  "), "Montefiore Randwick");
  assert.equal(searchPattern("  Montefiore, Randwick  "), "%Montefiore%Randwick%");
  assert.equal(searchPattern("%_*(),"), null);
});

test("routes each global result type to its useful workspace", () => {
  const base = { object_id: "object-1", provider_id: "provider-1" };
  assert.equal(searchResultHref({ ...base, object_type: "provider" }), "/providers/provider-1?tab=overview");
  assert.equal(searchResultHref({ ...base, object_type: "facility" }), "/providers/provider-1?tab=overview&facility=object-1#facility-object-1");
  assert.equal(searchResultHref({ ...base, object_type: "contact" }), "/providers/provider-1?tab=people#contact-object-1");
  assert.equal(searchResultHref({ ...base, object_type: "opportunity" }), "/opportunities/object-1");
  assert.equal(searchResultHref({ ...base, object_type: "customer" }), "/providers/provider-1?tab=commercial#customer");
  assert.equal(searchResultHref({ object_type: "provider", object_id: null, provider_id: null }), "/search");
});
