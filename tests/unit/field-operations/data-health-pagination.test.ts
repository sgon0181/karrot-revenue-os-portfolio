import assert from "node:assert/strict";
import test from "node:test";
import {
  pageNumber,
  pageRange,
  paginationHref,
  totalPages,
// Node's built-in type stripping requires the extension; the production
// TypeScript configuration intentionally does not enable TS extension imports.
// @ts-expect-error exercised directly with `node --experimental-strip-types --test`
} from "../../../src/features/data-health/lib/pagination.ts";

test("pagination sanitises untrusted query parameters", () => {
  assert.equal(pageNumber("2"), 2);
  assert.equal(pageNumber(["3", "4"]), 3);
  assert.equal(pageNumber("0"), 1);
  assert.equal(pageNumber("1.5"), 1);
  assert.equal(pageNumber("not-a-page"), 1);
});

test("pagination produces non-overlapping 25-row ranges", () => {
  assert.deepEqual(pageRange(1), { from: 0, to: 24 });
  assert.deepEqual(pageRange(2), { from: 25, to: 49 });
  assert.equal(totalPages(0), 1);
  assert.equal(totalPages(26), 2);
});

test("pagination links preserve independent sections and discard stale notices", () => {
  assert.equal(
    paginationHref({ runsPage: "2", issuesPage: "3", notice: "done" }, "runsPage", 4),
    "/data-health?runsPage=4&issuesPage=3",
  );
  assert.equal(paginationHref({ runsPage: "2" }, "runsPage", 1), "/data-health");
});
