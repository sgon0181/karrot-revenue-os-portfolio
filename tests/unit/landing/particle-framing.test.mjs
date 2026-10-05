import assert from "node:assert/strict";
import test from "node:test";

import {
  measureParticleBounds,
  resolveParticleFrame,
} from "../../../src/features/landing/lib/particle-framing.ts";

const HUMAN_BOUNDS = {
  minX: -0.725,
  maxX: 0.704,
  minY: -1.005,
  maxY: 1,
};

test("particle bounds measure the complete target", () => {
  assert.deepEqual(
    measureParticleBounds(new Float32Array([
      -2, 1, 7,
      4, -3, -8,
      1, 2, 0,
    ])),
    { minX: -2, maxX: 4, minY: -3, maxY: 2 },
  );
});

test("wide landscape screens keep the art-directed camera unchanged", () => {
  assert.deepEqual(
    resolveParticleFrame({
      width: 1_440,
      height: 900,
      desiredScale: 310,
      legacyCentreX: 1_008,
      legacyCentreY: 459,
      fromBounds: HUMAN_BOUNDS,
      toBounds: HUMAN_BOUNDS,
      transitionProgress: 0,
      depthStrength: 0.62,
    }),
    { centreX: 1_008, centreY: 459, scale: 310 },
  );
});

test("short phones pull a tall settled sculpture fully into the safe frame", () => {
  const frame = resolveParticleFrame({
    width: 467,
    height: 600,
    desiredScale: 220,
    legacyCentreX: 233.5,
    legacyCentreY: 186,
    fromBounds: HUMAN_BOUNDS,
    toBounds: HUMAN_BOUNDS,
    transitionProgress: 0,
    depthStrength: 0.62,
    safeBottom: 280,
  });

  const margin = 1 + 0.62 * 0.04;
  assert.ok(frame.scale < 100);
  assert.ok(frame.centreY - HUMAN_BOUNDS.maxY * frame.scale * margin >= 76);
  assert.ok(frame.centreY - HUMAN_BOUNDS.minY * frame.scale * margin <= 280);
});

test("mobile transition envelopes pull back farther than settled scenes", () => {
  const australia = {
    minX: -1.053,
    maxX: 1.048,
    minY: -0.985,
    maxY: 0.983,
  };
  const base = {
    width: 390,
    height: 844,
    desiredScale: 184,
    legacyCentreX: 195,
    legacyCentreY: 261.64,
    fromBounds: australia,
    toBounds: HUMAN_BOUNDS,
    depthStrength: 0.94,
  };
  const settled = resolveParticleFrame({ ...base, transitionProgress: 0 });
  const travelling = resolveParticleFrame({ ...base, transitionProgress: 0.5 });

  assert.ok(travelling.scale < settled.scale * 0.82);
  assert.ok(travelling.scale > 85);
});

test("invalid particle targets fail before reaching the renderer", () => {
  assert.throws(() => measureParticleBounds([]), /xyz triples/);
  assert.throws(
    () => measureParticleBounds([0, Number.NaN, 0]),
    /finite/,
  );
});
