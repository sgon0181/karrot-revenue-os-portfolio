import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  linkedInPersonProfileFromSources,
  linkedInPersonProfileUrl,
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
} from "../../../src/features/intelligence/lib/linkedin-profile.ts";

const root = resolve(import.meta.dirname, "../../..");

test("accepts only direct LinkedIn person-profile URLs", () => {
  assert.equal(
    linkedInPersonProfileUrl(
      "https://www.linkedin.com/in/peter-parker-123/?trk=public_profile#about",
    ),
    "https://www.linkedin.com/in/peter-parker-123/",
  );
  assert.equal(
    linkedInPersonProfileUrl("http://au.linkedin.com/in/norman_osborn"),
    "http://au.linkedin.com/in/norman_osborn",
  );

  for (const value of [
    "https://linkedin.example/in/peter-parker",
    "https://linkedin.com.example/in/peter-parker",
    "https://www.linkedin.com/company/oscorp",
    "https://www.linkedin.com/jobs/view/123",
    "https://www.linkedin.com/in/peter-parker/details/experience/",
    "https://www.linkedin.com/in/peter%2Fparker",
    "https://user@www.linkedin.com/in/peter-parker",
    "javascript:alert(1)",
    "not a url",
  ]) {
    assert.equal(linkedInPersonProfileUrl(value), null, value);
  }
});

test("finds a profile among cited sources and treats absence as normal", () => {
  assert.equal(
    linkedInPersonProfileFromSources([
      { url: "https://example.com/leadership" },
      { url: "https://linkedin.com/in/peter-parker" },
    ]),
    "https://linkedin.com/in/peter-parker",
  );
  assert.equal(
    linkedInPersonProfileFromSources([
      { url: "https://example.com/leadership" },
    ]),
    null,
  );
});

test("person findings display LinkedIn and promotion carries the profile URL", () => {
  const people = readFileSync(
    join(root, "src/features/intelligence/components/research-people.tsx"),
    "utf8",
  );
  const card = readFileSync(
    join(root, "src/features/intelligence/components/claim-card.tsx"),
    "utf8",
  );
  const controls = readFileSync(
    join(
      root,
      "src/features/intelligence/components/claim-review-controls.tsx",
    ),
    "utf8",
  );

  assert.match(people, /linkedInPersonProfileFromSources\(sources\)/);
  assert.match(people, /linkedInPersonProfileUrl\(source\.url\) === null/);
  assert.match(people, />\s*LinkedIn\s*<ExternalLink/);
  assert.match(people, />\s*Evidence\s*<ExternalLink/);
  assert.match(card, /claim\.category === "person"/);
  assert.match(card, />\s*LinkedIn\s*<ExternalLink/);
  assert.match(controls, /name="professional_profile_url"/);
  assert.match(controls, /value=\{linkedInProfileUrl\}/);
});
