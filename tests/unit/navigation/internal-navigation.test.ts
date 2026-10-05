import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import {
  DEFAULT_INTERNAL_PATH,
  internalPathLabel,
  loginPath,
  safeInternalPath,
  safeSingleInternalPath,
  samePathInternalPath,
  validatedInternalPath,
  validatedSingleInternalPath,
  validatedTasksPath,
  withInheritedHash,
  withReturnTo,
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
} from "../../../src/shared/lib/internal-navigation.ts";

function wrappedReturnTo(value: string, depth: number) {
  let wrapped = value;
  for (let layer = 0; layer < depth; layer += 1) {
    wrapped = `/providers/provider-${layer}?returnTo=${encodeURIComponent(wrapped)}`;
  }
  return wrapped;
}

test("accepts internal routes while preserving query and hash context", () => {
  const path = "/providers/provider-1?tab=people&facility=facility-1#contact-2";
  assert.equal(validatedInternalPath(path), path);
  assert.equal(safeInternalPath(path), path);
  assert.equal(validatedInternalPath("/"), "/");
  assert.equal(validatedInternalPath("/search?q=Blue%20Care"), "/search?q=Blue%20Care");
});

test("rejects external, protocol-relative, scheme, and non-path targets", () => {
  for (const value of [
    "//evil.example/steal",
    "///evil.example/steal",
    "https://evil.example/steal",
    "http://evil.example/steal",
    "javascript:alert(1)",
    "data:text/html,hello",
    "providers/provider-1",
    "",
    undefined,
    null,
  ]) {
    assert.equal(validatedInternalPath(value), null, String(value));
    assert.equal(safeInternalPath(value), DEFAULT_INTERNAL_PATH, String(value));
  }
});

test("rejects raw and decoded slashes, backslashes, and control characters", () => {
  for (const value of [
    "/\\evil.example",
    "/providers\\provider-1",
    "/%5cevil.example",
    "/%5C%5Cevil.example",
    "/%2fevil.example",
    "/%2F%2Fevil.example",
    "/providers/%00provider-1",
    "/providers/%0Aprovider-1",
    "/providers\nprovider-1",
    "/providers\u007fprovider-1",
  ]) {
    assert.equal(validatedInternalPath(value), null, value);
  }
});

test("rejects ordinary, encoded, repeated, and protocol-relative dot segments", () => {
  for (const value of [
    "/providers/../dashboard",
    "/providers/./account",
    "/customers/../../providers/provider-1",
    "/customers/%2e%2e/providers/provider-1",
    "/customers/%2E%2E/providers/provider-1",
    "/customers/.%2e/providers/provider-1",
    "/customers/%2e./providers/provider-1",
    "/customers/%252e%252e/providers/provider-1",
    "/providers/..//evil.example/x",
    "/%2e%2e//evil.example/x",
    "/providers/%2E%2E//evil.example/x?keep=query#context",
  ]) {
    assert.equal(validatedInternalPath(value), null, value);
    assert.equal(safeInternalPath(value), DEFAULT_INTERNAL_PATH, value);
  }
});

test("rejects delimiters revealed inside the encoded path component", () => {
  for (const value of [
    "/a/%3f/%2e%2e/b",
    "/a/%23/%2e%2e/b",
    "/a/%253f/%252e%252e/b",
    "/a/%3F/.%2E/b",
    "/a/%253f/%2e%2e/b",
    "/a/%3f/%252e%252e/b",
    "/a/%2523/.%2E/b",
    "/a/%23/.%252E/b",
  ]) {
    for (let nestedDepth = 0; nestedDepth <= 2; nestedDepth += 1) {
      const candidate = wrappedReturnTo(value, nestedDepth);
      const label = `${value} at nested return depth ${nestedDepth}`;
      assert.equal(validatedInternalPath(candidate), null, label);
      assert.equal(safeInternalPath(candidate), DEFAULT_INTERNAL_PATH, label);
      assert.equal(safeSingleInternalPath([candidate]), DEFAULT_INTERNAL_PATH, label);
      assert.equal(withReturnTo("/login", candidate), "/login", label);
    }
  }

  // Encoded question/hash characters could be legitimate path data, but this
  // boundary deliberately rejects them because decoding changes URL structure.
  for (const value of ["/docs/what%3Fnow", "/docs/section%23one"]) {
    assert.equal(validatedInternalPath(value), null, value);
  }

  assert.equal(
    validatedInternalPath("/docs/what?mode=now#section-one"),
    "/docs/what?mode=now#section-one",
  );
  assert.equal(
    validatedInternalPath("/search?q=what%3Fnow#section%23one"),
    "/search?q=what%3Fnow#section%23one",
  );
});

test("fails closed on excessive encoding depth with bounded validation work", () => {
  let deeplyEncodedDotSegment = "%2e%2e";
  for (let pass = 0; pass < 16_000; pass += 1) {
    deeplyEncodedDotSegment = deeplyEncodedDotSegment.replaceAll("%", "%25");
  }

  const startedAt = performance.now();
  assert.equal(
    validatedInternalPath(`/providers/${deeplyEncodedDotSegment}/account`),
    null,
  );
  const elapsedMilliseconds = performance.now() - startedAt;

  assert.ok(
    elapsedMilliseconds < 250,
    `validation took ${elapsedMilliseconds.toFixed(1)}ms`,
  );
});

test("revalidates every decoded layer and rejects masked unsafe paths", () => {
  for (const value of [
    "/providers%255c%252e%252e%255ctasks",
    "/providers/%252e%252e/tasks/%25GG",
    "/%255c%255cevil.example/steal",
    "/%25255c%25255cevil.example/steal",
    "/%252f%252fevil.example/steal",
    "/%252f%255cevil.example/steal",
    "/providers/%2500/account",
    "/providers/%2509/account",
    "/providers/%250A/account",
    "/providers/%250D/account",
    "/providers/%257f/account",
    "/providers/%25c2%2585/account",
    "/providers/%252500/account",
    "/providers%255C%252E%252E%255Ctasks",
    "/providers/%252E%252E/tasks/%25",
    "/providers/%252e%252e/tasks/%25E0%25A4%25A",
    "/%255C%252Fevil.example/steal",
  ]) {
    for (let nestedDepth = 0; nestedDepth <= 2; nestedDepth += 1) {
      const candidate = wrappedReturnTo(value, nestedDepth);
      const label = `${value} at nested return depth ${nestedDepth}`;
      assert.equal(validatedInternalPath(candidate), null, label);
      assert.equal(safeInternalPath(candidate), DEFAULT_INTERNAL_PATH, label);
      assert.equal(withReturnTo("/login", candidate), "/login", label);
    }
  }

  const recursivelyEncodedSeeds = [
    "/%2f%2fevil.example/x",
    "/%5c%5cevil.example/x",
    "/%2f%5cevil.example/x",
    "/%5c%2fevil.example/x",
    "/a/%2e%2e/b",
    "/a/.%2e/b",
    "/a/%2e./b",
    "/a/%3f/%2e%2e/b",
    "/a/%23/%2e%2e/b",
    "/a/%3F/.%2E/b",
    "/a/%23/%2e./b",
    "/a/%253f/%2e%2e/b",
    "/a/%3f/%252e%252e/b",
    "/a/%2523/.%2E/b",
    "/a/%23/.%252E/b",
    "/docs/what%3Fnow",
    "/docs/section%23one",
    "/a%2f%2e%2e%2fb",
    "/a%5c%2e%2e%5cb",
    "/a/%00/b",
    "/a/%09/b",
    "/a/%0a/b",
    "/a/%0d/b",
    "/a/%7f/b",
    "/a/%c2%85/b",
    "/?q=%0a",
    "/#%0a",
    "/a/%GG/b",
    "/a/%E0%A4%A/b",
    "/a/%C0%AF/b",
    "/a/%ED%A0%80/b",
  ];
  for (const seed of recursivelyEncodedSeeds) {
    let candidate = seed;
    for (let depth = 0; depth <= 7; depth += 1) {
      for (let nestedDepth = 0; nestedDepth <= 2; nestedDepth += 1) {
        const nestedCandidate = wrappedReturnTo(candidate, nestedDepth);
        const label = `${seed} at percent-encoding depth ${depth} and nested return depth ${nestedDepth}`;
        assert.equal(validatedInternalPath(nestedCandidate), null, label);
        assert.equal(safeInternalPath(nestedCandidate), DEFAULT_INTERNAL_PATH, label);
        assert.equal(withReturnTo("/login", nestedCandidate), "/login", label);
      }
      candidate = candidate.replaceAll("%", "%25");
    }
  }
});

test("fails closed when a valid percent escape reveals malformed later encoding", () => {
  for (const value of [
    "/search?q=Blue%25Care",
    "/providers?q=100%25&page=1",
    "/tasks#progress-%25",
  ]) {
    assert.equal(validatedInternalPath(value), null, value);
    assert.equal(safeInternalPath(value), DEFAULT_INTERNAL_PATH, value);
  }
});

test("allows dots in query and fragment values because they are not path segments", () => {
  const path = "/search?q=../provider&note=.%2E#../context";
  assert.equal(validatedInternalPath(path), path);
});

test("rejects malformed percent encoding", () => {
  for (const value of ["/providers/%", "/providers/%2", "/providers/%GG", "/%E0%A4%A"]) {
    assert.equal(validatedInternalPath(value), null, value);
  }
});

test("uses a validated fallback and never trusts an invalid fallback", () => {
  assert.equal(safeInternalPath(undefined, "/tasks?filter=due"), "/tasks?filter=due");
  assert.equal(safeInternalPath(undefined, "https://evil.example"), DEFAULT_INTERNAL_PATH);
});

test("requires exactly one internal path at query and form boundaries", () => {
  assert.equal(validatedSingleInternalPath(["/tasks?filter=open"]), "/tasks?filter=open");
  assert.equal(validatedSingleInternalPath([]), null);
  assert.equal(validatedSingleInternalPath(["/tasks", "/tasks"]), null);
  assert.equal(validatedSingleInternalPath(["/tasks", "//evil.example"]), null);
  assert.equal(validatedSingleInternalPath(["//evil.example", "/tasks"]), null);
  assert.equal(safeSingleInternalPath(["/tasks", "/providers"]), DEFAULT_INTERNAL_PATH);
});

test("rejects nested duplicate returnTo query parameters", () => {
  for (const value of [
    "/login?returnTo=%2Ftasks&returnTo=%2Ftasks",
    "/login?returnTo=%2Ftasks&returnTo=%2F%2Fevil.example",
    "/providers/provider-1?returnTo=%2F%2Fevil.example&returnTo=%2Ftasks",
    "/providers/provider-1?returnTo=%2Ftasks&return%54o=%2Fpipeline",
    "/providers/provider-1?return%2554o=%2Ftasks",
    "/providers/provider-1?%2572eturnTo=%2Ftasks",
  ]) {
    assert.equal(validatedInternalPath(value), null, value);
  }

  for (const nested of [
    "/providers/provider-1?returnTo=%2Ftasks&returnTo=%2Fpipeline",
    "/providers/provider-1?returnTo=//evil.example/steal",
    "/providers/provider-1?returnTo=/customers/%252e%252e/tasks",
    "/providers/provider-1?returnTo=/tasks/%25GG",
    "/providers/provider-1?returnTo=/%255c%255cevil.example/steal",
    "/providers/provider-1?returnTo=/providers/%2500/account",
  ]) {
    const value = `/opportunities/opportunity-1?returnTo=${encodeURIComponent(nested)}`;
    assert.equal(validatedInternalPath(value), null, nested);
    assert.equal(safeInternalPath(value), DEFAULT_INTERNAL_PATH, nested);
  }

  let excessiveNesting = "/tasks?filter=open";
  for (let depth = 0; depth < 6; depth += 1) {
    excessiveNesting = `/providers/provider-${depth}?returnTo=${encodeURIComponent(excessiveNesting)}`;
  }
  assert.equal(validatedInternalPath(excessiveNesting), null);
});

test("encoded query data does not become a duplicate outer return parameter", () => {
  const path = "/search?q=one%26returnTo%3Dtwo#result";
  assert.equal(validatedInternalPath(path), path);
  assert.equal(
    validatedInternalPath("/providers/provider-1?return%54o=%2Ftasks"),
    "/providers/provider-1?return%54o=%2Ftasks",
  );
});

test("inherits a browser fragment without replacing existing or safe context", () => {
  assert.equal(
    withInheritedHash("/providers/provider-1?tab=commercial", "#customer"),
    "/providers/provider-1?tab=commercial#customer",
  );
  assert.equal(
    withInheritedHash("/providers/provider-1?tab=people#contact-1", "#customer"),
    "/providers/provider-1?tab=people#contact-1",
  );
  assert.equal(withInheritedHash("//evil.example", "#customer"), null);
  assert.equal(
    withInheritedHash("/providers/provider-1?tab=commercial", "customer"),
    "/providers/provider-1?tab=commercial",
  );
  assert.equal(
    withInheritedHash("/providers/provider-1?tab=commercial", "#bad%GG"),
    "/providers/provider-1?tab=commercial",
  );
});

test("keeps route-scoped mutation destinations with allowed query and hash context", () => {
  assert.equal(
    samePathInternalPath("/pipeline#stage-qualified", "/pipeline"),
    "/pipeline#stage-qualified",
  );
  assert.equal(
    samePathInternalPath("/pipeline-report#stage-qualified", "/pipeline"),
    null,
  );
  assert.equal(
    validatedTasksPath("/tasks?filter=overdue#task-1"),
    "/tasks?filter=overdue#task-1",
  );
  assert.equal(validatedTasksPath("/tasks#task-1"), "/tasks#task-1");
  assert.equal(validatedTasksPath("/tasks?filter=unknown#task-1"), null);
  assert.equal(validatedTasksPath("/tasks?filter=open&next=evil"), null);
  assert.equal(validatedTasksPath("/tasks?filter=open&filter=mine"), null);
});

test("adds an optional returnTo without losing destination or origin context", () => {
  assert.equal(
    withReturnTo("/providers/provider-1?tab=people#contact-2", "/tasks?filter=due#today"),
    "/providers/provider-1?tab=people&returnTo=%2Ftasks%3Ffilter%3Ddue%23today#contact-2",
  );
  assert.equal(withReturnTo("/providers/provider-1", "//evil.example"), "/providers/provider-1");
  assert.equal(
    withReturnTo("/login?error=failed&returnTo=%2Ftasks&returnTo=%2Fproviders", undefined),
    DEFAULT_INTERNAL_PATH,
  );
});

test("builds a canonical login URL and encodes errors and return context", () => {
  const path = loginPath("/providers/provider-1?tab=evidence#source-1", "Bad & invalid");
  const url = new URL(path, "https://karrot.invalid");
  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("returnTo"), "/providers/provider-1?tab=evidence#source-1");
  assert.equal(url.searchParams.get("error"), "Bad & invalid");
  assert.equal(url.hash, "");

  assert.equal(
    new URL(loginPath("https://evil.example"), "https://karrot.invalid").searchParams.get("returnTo"),
    DEFAULT_INTERNAL_PATH,
  );
});

test("labels validated origins without reflecting untrusted input", () => {
  assert.equal(internalPathLabel("/dashboard"), "Home");
  assert.equal(internalPathLabel("/providers/provider-1?tab=people"), "Provider");
  assert.equal(internalPathLabel("/unknown/private/value"), "previous page");
  assert.equal(internalPathLabel("https://evil.example"), null);
});
