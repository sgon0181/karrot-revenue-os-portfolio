import assert from "node:assert/strict";
import test from "node:test";

import { resolveParticleQuality } from "../../../src/features/landing/lib/particle-quality.ts";

test("compact screens use a stable 30 fps balanced ceiling", () => {
  assert.deepEqual(
    resolveParticleQuality({
      width: 390,
      devicePixelRatio: 3,
      hardwareConcurrency: 6,
    }),
    {
      particleCount: 6_000,
      pixelRatio: 1.25,
      minimumFrameInterval: 1000 / 30,
      backgroundParticleCount: 280,
      tier: "balanced",
    },
  );
});

test("low-memory devices receive the constrained tier", () => {
  const quality = resolveParticleQuality({
    width: 1366,
    devicePixelRatio: 2,
    deviceMemory: 4,
    hardwareConcurrency: 8,
  });

  assert.equal(quality.tier, "constrained");
  assert.equal(quality.particleCount, 10_000);
  assert.equal(quality.pixelRatio, 1.15);
  assert.equal(quality.minimumFrameInterval, 1000 / 30);
});

test("capable wide screens retain the full reference treatment", () => {
  assert.deepEqual(
    resolveParticleQuality({
      width: 1440,
      devicePixelRatio: 2,
      deviceMemory: 8,
      hardwareConcurrency: 10,
    }),
    {
      particleCount: 20_000,
      pixelRatio: 1.5,
      minimumFrameInterval: 0,
      backgroundParticleCount: 1_200,
      tier: "high",
    },
  );
});

test("data saver always selects the lowest safe workload", () => {
  assert.equal(
    resolveParticleQuality({
      width: 390,
      devicePixelRatio: 3,
      hardwareConcurrency: 12,
      saveData: true,
    }).tier,
    "constrained",
  );
});
