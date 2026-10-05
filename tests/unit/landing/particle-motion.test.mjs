import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceExponential,
  buildTransitionBuffer,
  buildTransitionDescriptors,
  clamp01,
  coherentHashUnit,
  createTransitionBuffer,
  createParticlePathDescriptor,
  exponentialDamp,
  hashSigned,
  hashUint32,
  hashUnit,
  particleSceneIndex,
  resolveParticlePathProgress,
  COMPACT_SCENE_HOLD,
  resolveChapterScrollProgress,
  resolveTransitionBufferProgress,
  resolveTransitionPhase,
  sampleTransitionBufferPoint,
  sampleTransitionBufferPointAtProgress,
  sampleTransitionPoint,
  sampleCubicVortexPath,
  sampleParticlePath,
  smootherstep,
  smoothstep,
} from "../../../src/features/landing/lib/particle-motion.ts";

test("chapter-aware scroll progress follows measured section geometry", () => {
  const anchors = [400, 1_200, 2_000, 2_800, 3_900];
  assert.equal(resolveChapterScrollProgress(0, anchors), 0);
  assert.equal(resolveChapterScrollProgress(400, anchors), 0);
  assert.equal(resolveChapterScrollProgress(1_200, anchors), 0.25);
  assert.equal(resolveChapterScrollProgress(1_600, anchors), 0.375);
  assert.equal(resolveChapterScrollProgress(2_800, anchors), 0.75);
  assert.equal(resolveChapterScrollProgress(4_500, anchors), 1);
});

const START = [-0.82, 0.64, -0.18];
const END = [1.06, -0.71, 0.37];

function createDescriptor(index = 17, overrides = {}) {
  return createParticlePathDescriptor(START, END, {
    index,
    fromScene: 1,
    toScene: 2,
    ...overrides,
  });
}

function distance(first, second) {
  return Math.hypot(
    second[0] - first[0],
    second[1] - first[1],
    second[2] - first[2],
  );
}

function linearPoint(start, end, progress) {
  return [
    start[0] + (end[0] - start[0]) * progress,
    start[1] + (end[1] - start[1]) * progress,
    start[2] + (end[2] - start[2]) * progress,
  ];
}

function createTargets(count) {
  const source = new Float32Array(count * 3);
  const destination = new Float32Array(count * 3);
  const sourceEmphasis = new Uint8Array(count);
  const destinationEmphasis = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    source[index * 3] = Math.cos(angle) * 0.8;
    source[index * 3 + 1] = Math.sin(angle) * 0.6;
    source[index * 3 + 2] = Math.sin(angle * 2) * 0.12;
    destination[index * 3] = Math.cos(angle + 0.8) * 1.05;
    destination[index * 3 + 1] = Math.sin(angle + 0.8) * 0.76;
    destination[index * 3 + 2] = Math.cos(angle * 3) * 0.24;
    sourceEmphasis[index] = index % 3;
    destinationEmphasis[index] = (index + 1) % 3;
  }
  return { source, destination, sourceEmphasis, destinationEmphasis };
}

function assertPointClose(actual, expected, tolerance = 2e-6) {
  assert.equal(actual.length, 3);
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(actual[axis] - expected[axis]) <= tolerance,
      `axis ${axis}: ${actual[axis]} != ${expected[axis]}`,
    );
  }
}

test("deterministic hash helpers expose stable independent streams", () => {
  assert.equal(hashUint32(123456), hashUint32(123456));
  assert.notEqual(hashUint32(123456), hashUint32(123457));
  assert.equal(hashUnit(99, 14, 3), hashUnit(99, 14, 3));
  assert.notEqual(hashUnit(99, 14, 3), hashUnit(99, 14, 4));

  for (let index = 0; index < 1_000; index += 1) {
    const unit = hashUnit(8844, index, 2);
    const signed = hashSigned(8844, index, 2);
    assert.ok(unit >= 0 && unit < 1);
    assert.ok(signed >= -1 && signed < 1);
  }
});

test("shared easing helpers clamp their inputs", () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(smoothstep(0.5), 0.5);
  assert.equal(smootherstep(0.5), 0.5);
  assert.equal(smoothstep(-1), 0);
  assert.equal(smootherstep(2), 1);
});

test("transition resolver preserves 12% target holds without global easing", () => {
  const sceneCount = 5;
  const segmentProgress = (localProgress) => localProgress / (sceneCount - 1);

  assert.equal(
    resolveTransitionPhase(segmentProgress(0.1), sceneCount)
      .transitionProgress,
    0,
  );
  assert.equal(
    resolveTransitionPhase(segmentProgress(0.12), sceneCount)
      .transitionProgress,
    0,
  );
  assert.equal(
    resolveTransitionPhase(segmentProgress(0.5), sceneCount)
      .transitionProgress,
    0.5,
  );
  assert.equal(
    resolveTransitionPhase(segmentProgress(0.88), sceneCount)
      .transitionProgress,
    1,
  );
  assert.equal(
    resolveTransitionPhase(segmentProgress(0.96), sceneCount)
      .transitionProgress,
    1,
  );

  const secondScene = resolveTransitionPhase(0.25, sceneCount);
  assert.equal(secondScene.fromScene, 1);
  assert.equal(secondScene.toScene, 2);
  assert.equal(secondScene.localProgress, 0);
  assert.equal(secondScene.transitionProgress, 0);

  const finale = resolveTransitionPhase(1, sceneCount);
  assert.equal(finale.fromScene, 4);
  assert.equal(finale.toScene, 4);
  assert.equal(finale.transitionProgress, 0);
  assert.equal(resolveTransitionPhase(-1, sceneCount).progress, 0);
  assert.equal(resolveTransitionPhase(2, sceneCount).progress, 1);
});

test("compact hold keeps sculptures settled while fixed chapter copy shows", () => {
  const sceneCount = 5;
  const segmentProgress = (localProgress) => localProgress / (sceneCount - 1);

  assert.equal(COMPACT_SCENE_HOLD, 0.4);
  assert.equal(
    resolveTransitionPhase(segmentProgress(0.39), sceneCount, COMPACT_SCENE_HOLD)
      .transitionProgress,
    0,
  );
  assert.equal(
    resolveTransitionPhase(segmentProgress(0.5), sceneCount, COMPACT_SCENE_HOLD)
      .transitionProgress,
    0.5,
  );
  assert.equal(
    resolveTransitionPhase(segmentProgress(0.61), sceneCount, COMPACT_SCENE_HOLD)
      .transitionProgress,
    1,
  );
  // The wide hold must never leak into the default desktop behaviour.
  assert.equal(
    resolveTransitionPhase(segmentProgress(0.39), sceneCount)
      .transitionProgress > 0,
    true,
  );
});

test("particle staging applies exactly one easing pass", () => {
  const descriptor = createDescriptor();
  const quarter =
    descriptor.departure +
    (descriptor.arrival - descriptor.departure) * 0.25;
  const middle = (descriptor.departure + descriptor.arrival) * 0.5;

  // Quintic smootherstep(0.25). A second easing pass would be ~0.009.
  assert.ok(
    Math.abs(resolveParticlePathProgress(descriptor, quarter) - 0.103515625) <
      1e-12,
  );
  assert.ok(
    Math.abs(resolveParticlePathProgress(descriptor, middle) - 0.5) < 1e-12,
  );
  assert.equal(resolveParticlePathProgress(descriptor, 0), 0);
  assert.equal(resolveParticlePathProgress(descriptor, 1), 1);
});

test("cubic vortex paths are deterministic and preserve exact endpoints", () => {
  const descriptor = createDescriptor();
  assert.deepEqual(descriptor, createDescriptor());
  assert.deepEqual(sampleParticlePath(descriptor, 0), START);
  assert.deepEqual(sampleParticlePath(descriptor, 1), END);
  assert.deepEqual(sampleCubicVortexPath(descriptor, 0), START);
  assert.deepEqual(sampleCubicVortexPath(descriptor, 1), END);

  const reusable = [0, 0, 0];
  assert.strictEqual(sampleParticlePath(descriptor, 0.5, reusable), reusable);
  assert.deepEqual(sampleTransitionPoint(descriptor, 0), START);
});

test("scene mappings preserve static point sets and close on the same logo", () => {
  const count = 257;
  for (let scene = 0; scene < 5; scene += 1) {
    const mapped = Array.from({ length: count }, (_, index) =>
      particleSceneIndex(index, scene, count),
    );
    assert.equal(new Set(mapped).size, count);
    assert.ok(mapped.every((index) => index >= 0 && index < count));
  }
  for (let index = 0; index < count; index += 1) {
    assert.equal(
      particleSceneIndex(index, 0, count),
      particleSceneIndex(index, 4, count),
    );
  }
});

test("transition builder records mapped indices, phases and cubic controls", () => {
  const count = 64;
  const source = new Float32Array(count * 3);
  const destination = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    source[index * 3] = index / count;
    source[index * 3 + 1] = index / count - 0.5;
    destination[index * 3] = 1 - index / count;
    destination[index * 3 + 1] = 0.5 - index / count;
    destination[index * 3 + 2] = 0.2;
  }

  const descriptors = buildTransitionDescriptors(source, destination, {
    particleCount: count,
    fromScene: 1,
    toScene: 2,
  });
  assert.equal(descriptors.length, count);
  for (const descriptor of descriptors) {
    assert.equal(
      descriptor.sourceIndex,
      particleSceneIndex(descriptor.particleIndex, 1, count),
    );
    assert.equal(
      descriptor.destinationIndex,
      particleSceneIndex(descriptor.particleIndex, 2, count),
    );
    assert.equal(descriptor.startPhase, descriptor.departure);
    assert.equal(descriptor.endPhase, descriptor.arrival);
    assert.equal(descriptor.controlOne.length, 3);
    assert.equal(descriptor.controlTwo.length, 3);
    assert.deepEqual(sampleTransitionPoint(descriptor, 0), descriptor.start);
    assert.deepEqual(sampleTransitionPoint(descriptor, 1), descriptor.end);
  }
});

test("typed transition buffers match object descriptors without intermediates", () => {
  const count = 257;
  const targets = createTargets(count);
  const options = {
    particleCount: count,
    fromScene: 1,
    toScene: 2,
    sourceEmphasis: targets.sourceEmphasis,
    destinationEmphasis: targets.destinationEmphasis,
  };
  const descriptors = buildTransitionDescriptors(
    targets.source,
    targets.destination,
    options,
  );
  const reusableBuffer = createTransitionBuffer(count);
  const buffer = buildTransitionBuffer(
    targets.source,
    targets.destination,
    options,
    reusableBuffer,
  );

  assert.strictEqual(buffer, reusableBuffer);
  assert.ok(buffer.startX instanceof Float32Array);
  assert.ok(buffer.sourceIndices instanceof Uint32Array);
  assert.ok(buffer.laneDirections instanceof Int8Array);
  for (let index = 0; index < count; index += 1) {
    const descriptor = descriptors[index];
    assert.equal(buffer.sourceIndices[index], descriptor.sourceIndex);
    assert.equal(buffer.destinationIndices[index], descriptor.destinationIndex);
    assertPointClose(
      [buffer.startX[index], buffer.startY[index], buffer.startZ[index]],
      descriptor.start,
      0,
    );
    assertPointClose(
      [buffer.endX[index], buffer.endY[index], buffer.endZ[index]],
      descriptor.end,
      0,
    );
    assertPointClose(
      [
        buffer.controlOneX[index],
        buffer.controlOneY[index],
        buffer.controlOneZ[index],
      ],
      descriptor.controlOne,
    );
    assertPointClose(
      [
        buffer.controlTwoX[index],
        buffer.controlTwoY[index],
        buffer.controlTwoZ[index],
      ],
      descriptor.controlTwo,
    );
    assert.ok(
      Math.abs(buffer.startPhases[index] - descriptor.startPhase) < 1e-7,
    );
    assert.ok(
      Math.abs(buffer.endPhases[index] - descriptor.endPhase) < 1e-7,
    );
    assert.equal(buffer.laneDirections[index], descriptor.laneDirection);

    for (const progress of [0, 0.13, 0.37, 0.5, 0.83, 1]) {
      assertPointClose(
        sampleTransitionBufferPoint(buffer, index, progress),
        sampleTransitionPoint(descriptor, progress),
      );
    }
  }
});

test("buffer mappings are bijective and sampling is endpoint-exact and reversible", () => {
  const count = 384;
  const targets = createTargets(count);
  const buffer = buildTransitionBuffer(targets.source, targets.destination, {
    particleCount: count,
    fromScene: 2,
    toScene: 3,
  });
  assert.equal(new Set(buffer.sourceIndices).size, count);
  assert.equal(new Set(buffer.destinationIndices).size, count);

  const output = [0, 0, 0];
  for (let index = 0; index < count; index += 1) {
    assert.strictEqual(
      sampleTransitionBufferPoint(buffer, index, 0, output),
      output,
    );
    assert.deepEqual(output, [
      buffer.startX[index],
      buffer.startY[index],
      buffer.startZ[index],
    ]);
    assert.deepEqual(sampleTransitionBufferPoint(buffer, index, 1), [
      buffer.endX[index],
      buffer.endY[index],
      buffer.endZ[index],
    ]);
  }

  const index = 143;
  const forward = Array.from({ length: 101 }, (_, step) =>
    sampleTransitionBufferPoint(buffer, index, step / 100),
  );
  for (let step = 100; step >= 0; step -= 1) {
    assert.deepEqual(
      sampleTransitionBufferPoint(buffer, index, step / 100),
      forward[step],
    );
  }
});

test("buffer flight is continuous across departure and arrival boundaries", () => {
  const count = 128;
  const targets = createTargets(count);
  const buffer = buildTransitionBuffer(targets.source, targets.destination, {
    particleCount: count,
    fromScene: 0,
    toScene: 1,
  });
  const index = 57;
  const departure = buffer.startPhases[index];
  const arrival = buffer.endPhases[index];
  const start = [
    buffer.startX[index],
    buffer.startY[index],
    buffer.startZ[index],
  ];
  const end = [buffer.endX[index], buffer.endY[index], buffer.endZ[index]];

  assert.deepEqual(
    sampleTransitionBufferPoint(buffer, index, departure),
    start,
  );
  assert.deepEqual(sampleTransitionBufferPoint(buffer, index, arrival), end);
  assert.ok(
    distance(
      sampleTransitionBufferPoint(buffer, index, departure + 1e-5),
      start,
    ) < 1e-9,
  );
  assert.ok(
    distance(
      sampleTransitionBufferPoint(buffer, index, arrival - 1e-5),
      end,
    ) < 1e-9,
  );

  const halfway = resolveTransitionBufferProgress(buffer, index, 0.5);
  const reused = [0, 0, 0];
  assert.strictEqual(
    sampleTransitionBufferPointAtProgress(buffer, index, halfway, reused),
    reused,
  );
});

test("path sampling is continuous and exactly reversible under scroll", () => {
  const descriptor = createDescriptor();
  const forward = [];
  let previous = sampleParticlePath(descriptor, 0);
  let maximumStep = 0;

  for (let step = 0; step <= 1_000; step += 1) {
    const point = sampleParticlePath(descriptor, step / 1_000);
    forward.push(point);
    maximumStep = Math.max(maximumStep, distance(previous, point));
    previous = point;
  }

  assert.ok(maximumStep < 0.025);
  for (let step = 1_000; step >= 0; step -= 1) {
    assert.deepEqual(
      sampleParticlePath(descriptor, step / 1_000),
      forward[step],
    );
  }
});

test("particle descriptors distribute departure times and vortex lanes", () => {
  const descriptors = Array.from({ length: 1_024 }, (_, index) =>
    createDescriptor(index),
  );
  const positiveLanes = descriptors.filter(
    ({ laneDirection }) => laneDirection === 1,
  ).length;
  const negativeLanes = descriptors.length - positiveLanes;
  const departures = descriptors.map(({ departure }) => departure);
  const phases = new Set(
    descriptors.map(({ vortexPhase }) => Math.floor(vortexPhase / (Math.PI / 4))),
  );

  assert.ok(positiveLanes > 350);
  assert.ok(negativeLanes > 350);
  assert.ok(Math.max(...departures) - Math.min(...departures) > 0.2);
  assert.ok(phases.size >= 7);
  assert.ok(descriptors.some(({ vortexTurns }) => vortexTurns > 0));
  assert.ok(descriptors.some(({ vortexTurns }) => vortexTurns < 0));
});

test("clustered randomness stays coherent through 96-particle boundaries", () => {
  const seed = 20260825;
  let adjacentDifference = 0;
  let distantDifference = 0;
  let boundaryDifference = 0;
  const sampleCount = 5_000;
  for (let index = 0; index < sampleCount; index += 1) {
    adjacentDifference += Math.abs(
      coherentHashUnit(seed, index, 3) -
        coherentHashUnit(seed, index + 1, 3),
    );
    distantDifference += Math.abs(
      coherentHashUnit(seed, index, 3) -
        coherentHashUnit(seed, index + 384, 3),
    );
  }
  for (let cluster = 1; cluster <= 50; cluster += 1) {
    const boundary = cluster * 96;
    boundaryDifference += Math.abs(
      coherentHashUnit(seed, boundary - 1, 3) -
        coherentHashUnit(seed, boundary, 3),
    );
  }
  adjacentDifference /= sampleCount;
  distantDifference /= sampleCount;
  boundaryDifference /= 50;

  assert.ok(adjacentDifference < 0.09);
  assert.ok(boundaryDifference < 0.1);
  assert.ok(distantDifference > adjacentDifference * 2.5);

  const descriptors = Array.from({ length: sampleCount + 384 }, (_, index) =>
    createDescriptor(index),
  );
  let adjacentTimingDifference = 0;
  let distantTimingDifference = 0;
  let adjacentLaneAgreement = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    adjacentTimingDifference += Math.abs(
      descriptors[index].departure - descriptors[index + 1].departure,
    );
    distantTimingDifference += Math.abs(
      descriptors[index].departure - descriptors[index + 384].departure,
    );
    adjacentLaneAgreement += Number(
      descriptors[index].laneDirection === descriptors[index + 1].laneDirection,
    );
  }
  // Timing keeps more per-dot jitter than geometry so spatial neighborhoods
  // read as streams rather than synchronized 96-dot clumps.
  assert.ok(adjacentTimingDifference < distantTimingDifference * 0.72);
  assert.ok(adjacentLaneAgreement / sampleCount > 0.84);
});

test("flight remains inside each descriptor's declared deviation bound", () => {
  const maximumExcursion = 0.36;
  for (let index = 0; index < 128; index += 1) {
    const descriptor = createDescriptor(index, { maximumExcursion });
    assert.ok(descriptor.maxDeviation <= maximumExcursion + 1e-12);

    for (let step = 0; step <= 200; step += 1) {
      const progress = step / 200;
      const point = sampleCubicVortexPath(descriptor, progress);
      const baseline = linearPoint(START, END, progress);
      assert.ok(point.every(Number.isFinite));
      assert.ok(
        distance(point, baseline) <= descriptor.maxDeviation + 1e-12,
      );
    }
  }

  const staticDescriptor = createParticlePathDescriptor(START, START, {
    index: 3,
    fromScene: 0,
    toScene: 4,
  });
  assert.equal(staticDescriptor.maxDeviation, 0);
  assert.deepEqual(sampleParticlePath(staticDescriptor, 0.5), START);
});

test("exponential damping is frame-rate independent and never overshoots", () => {
  const oneStep = advanceExponential(0, 1, 100, 155);
  let tenSteps = 0;
  for (let index = 0; index < 10; index += 1) {
    tenSteps = advanceExponential(tenSteps, 1, 10, 155);
  }

  assert.ok(Math.abs(oneStep - tenSteps) < 1e-12);
  assert.equal(exponentialDamp(0, 1, 100, 155), oneStep);
  assert.ok(oneStep > 0 && oneStep < 1);
  assert.equal(exponentialDamp(0.4, 1, 0, 155), 0.4);
  assert.equal(exponentialDamp(0.4, 1, 16, 0), 1);

  let increasing = -2;
  for (let index = 0; index < 100; index += 1) {
    const next = exponentialDamp(increasing, 3, 16.67, 200);
    assert.ok(next >= increasing && next <= 3);
    increasing = next;
  }

  let decreasing = 3;
  for (let index = 0; index < 100; index += 1) {
    const next = exponentialDamp(decreasing, -2, 16.67, 200);
    assert.ok(next <= decreasing && next >= -2);
    decreasing = next;
  }
});
