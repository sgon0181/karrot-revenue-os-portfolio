export type MotionPoint3 = readonly [x: number, y: number, z: number];
export type MutableMotionPoint3 = [x: number, y: number, z: number];

export const DEFAULT_SCENE_HOLD = 0.12;
// Compact layouts pin chapter copy as a fixed overlay, so a chapter's text
// stays on screen across the whole inter-anchor scroll range. A narrow hold
// there leaves shapes visibly mid-morph while their chapter is being read;
// the wide hold keeps each sculpture settled and plays the morph only across
// the short window where the copy itself crossfades.
export const COMPACT_SCENE_HOLD = 0.4;
export const DEFAULT_MOTION_SEED = 20260825;
export const PARTICLE_MOTION_CLUSTER_SIZE = 96;
export const PARTICLE_MOTION_CLUSTER_WEIGHT = 0.8;

export type TransitionPhase = {
  progress: number;
  fromScene: number;
  toScene: number;
  localProgress: number;
  transitionProgress: number;
};

export type ParticlePathOptions = {
  index: number;
  fromScene: number;
  toScene: number;
  seed?: number;
  emphasis?: number;
  maximumExcursion?: number;
  sourceIndex?: number;
  destinationIndex?: number;
};

export type BuildTransitionDescriptorsOptions = {
  particleCount: number;
  fromScene: number;
  toScene: number;
  seed?: number;
  sourceEmphasis?: ArrayLike<number>;
  destinationEmphasis?: ArrayLike<number>;
  maximumExcursion?: number;
};

export type ParticlePathDescriptor = {
  particleIndex: number;
  sourceIndex: number;
  destinationIndex: number;
  start: MotionPoint3;
  controlOne: MotionPoint3;
  controlTwo: MotionPoint3;
  end: MotionPoint3;
  vortexU: MotionPoint3;
  vortexV: MotionPoint3;
  vortexRadius: number;
  vortexTurns: number;
  vortexPhase: number;
  startPhase: number;
  endPhase: number;
  departure: number;
  arrival: number;
  laneDirection: -1 | 1;
  maxDeviation: number;
};

export type ParticleTransitionBuffer = {
  count: number;
  sourceIndices: Uint32Array;
  destinationIndices: Uint32Array;
  startX: Float32Array;
  startY: Float32Array;
  startZ: Float32Array;
  controlOneX: Float32Array;
  controlOneY: Float32Array;
  controlOneZ: Float32Array;
  controlTwoX: Float32Array;
  controlTwoY: Float32Array;
  controlTwoZ: Float32Array;
  endX: Float32Array;
  endY: Float32Array;
  endZ: Float32Array;
  vortexUX: Float32Array;
  vortexUY: Float32Array;
  vortexUZ: Float32Array;
  vortexVX: Float32Array;
  vortexVY: Float32Array;
  vortexVZ: Float32Array;
  vortexRadii: Float32Array;
  vortexTurns: Float32Array;
  vortexPhases: Float32Array;
  startPhases: Float32Array;
  endPhases: Float32Array;
  laneDirections: Int8Array;
  maxDeviations: Float32Array;
};

const UINT32_RANGE = 4_294_967_296;
const TAU = Math.PI * 2;
const SCENE_INDEX_OFFSET_RATIOS = [0, 0.173, 0.419, 0.683, 0] as const;

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export const clampUnit = clamp01;

/** Maps a viewport anchor across measured chapter anchors to scene progress. */
export function resolveChapterScrollProgress(
  viewportAnchor: number,
  sceneAnchors: readonly number[],
) {
  if (sceneAnchors.length < 2) return 0;
  if (viewportAnchor <= sceneAnchors[0]) return 0;
  const lastIndex = sceneAnchors.length - 1;
  if (viewportAnchor >= sceneAnchors[lastIndex]) return 1;

  for (let index = 0; index < lastIndex; index += 1) {
    const start = sceneAnchors[index];
    const end = sceneAnchors[index + 1];
    if (viewportAnchor <= end) {
      const localProgress = clamp01(
        (viewportAnchor - start) / Math.max(1, end - start),
      );
      return (index + localProgress) / lastIndex;
    }
  }

  return 1;
}

export function smoothstep(value: number) {
  const bounded = clamp01(value);
  return bounded * bounded * (3 - 2 * bounded);
}

export function smootherstep(value: number) {
  const bounded = clamp01(value);
  return (
    bounded *
    bounded *
    bounded *
    (bounded * (bounded * 6 - 15) + 10)
  );
}

/** A small integer avalanche hash suitable for repeatable particle identities. */
export function hashUint32(value: number) {
  let state = value >>> 0;
  state = Math.imul(state ^ (state >>> 16), 0x7feb352d);
  state = Math.imul(state ^ (state >>> 15), 0x846ca68b);
  state ^= state >>> 16;
  return state >>> 0;
}

/** Returns a deterministic value in [0, 1) for an identity and named stream. */
export function hashUnit(seed: number, index = 0, stream = 0) {
  const mixed =
    (seed >>> 0) ^
    Math.imul((index + 1) >>> 0, 0x9e3779b1) ^
    Math.imul((stream + 1) >>> 0, 0x85ebca77);
  return hashUint32(mixed) / UINT32_RANGE;
}

/** Returns the same deterministic stream mapped to [-1, 1). */
export function hashSigned(seed: number, index = 0, stream = 0) {
  return hashUnit(seed, index, stream) * 2 - 1;
}

/**
 * Blends smoothly interpolated cluster anchors with per-particle jitter.
 * Neighbouring source indices therefore travel as broad streams without
 * becoming mechanically identical.
 */
export function coherentHashUnit(
  seed: number,
  sourceIndex: number,
  stream = 0,
  clusterSize = PARTICLE_MOTION_CLUSTER_SIZE,
  clusterWeight = PARTICLE_MOTION_CLUSTER_WEIGHT,
) {
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0) {
    throw new RangeError("Source index must be a non-negative integer.");
  }
  if (!Number.isInteger(clusterSize) || clusterSize < 1) {
    throw new RangeError("Cluster size must be a positive integer.");
  }
  if (!Number.isFinite(clusterWeight) || clusterWeight < 0 || clusterWeight > 1) {
    throw new RangeError("Cluster weight must be between 0 and 1.");
  }

  const clusterPosition = sourceIndex / clusterSize;
  const leftCluster = Math.floor(clusterPosition);
  const clusterFraction = smoothstep(clusterPosition - leftCluster);
  const clusterStream = stream * 2;
  const leftSignal = hashUnit(seed, leftCluster, clusterStream);
  const rightSignal = hashUnit(seed, leftCluster + 1, clusterStream);
  const clusterSignal =
    leftSignal + (rightSignal - leftSignal) * clusterFraction;
  const particleSignal = hashUnit(seed, sourceIndex, clusterStream + 1_001);
  return (
    clusterSignal * clusterWeight + particleSignal * (1 - clusterWeight)
  );
}

/**
 * Maps document progress to one scene pair. The first and last 12% of each
 * segment are exact-target holds. Deliberately no easing happens here: each
 * particle receives one easing pass after its own departure/arrival window.
 */
export function resolveTransitionPhase(
  storyProgress: number,
  sceneCount: number,
  hold = DEFAULT_SCENE_HOLD,
): TransitionPhase {
  if (!Number.isFinite(storyProgress)) {
    throw new TypeError("Story progress must be finite.");
  }
  if (!Number.isInteger(sceneCount) || sceneCount < 1) {
    throw new TypeError("Scene count must be a positive integer.");
  }
  if (!Number.isFinite(hold) || hold < 0 || hold >= 0.5) {
    throw new RangeError("Scene hold must be between 0 and 0.5.");
  }

  const progress = clampUnit(storyProgress);
  if (sceneCount === 1 || progress === 1) {
    const finalScene = sceneCount - 1;
    return {
      progress,
      fromScene: finalScene,
      toScene: finalScene,
      localProgress: 0,
      transitionProgress: 0,
    };
  }

  const scaledProgress = progress * (sceneCount - 1);
  const fromScene = Math.floor(scaledProgress);
  const toScene = fromScene + 1;
  const localProgress = scaledProgress - fromScene;
  const transitionProgress = clampUnit(
    (localProgress - hold) / (1 - hold * 2),
  );

  return {
    progress,
    fromScene,
    toScene,
    localProgress,
    transitionProgress,
  };
}

/**
 * Maps a persistent particle identity to a target-scene index. Every scene is
 * a cyclic permutation, so the static point set is unchanged. The opening and
 * finale deliberately use the same mapping.
 */
export function particleSceneIndex(
  particleIndex: number,
  sceneIndex: number,
  particleCount: number,
) {
  if (
    !Number.isInteger(particleIndex) ||
    particleIndex < 0 ||
    !Number.isInteger(sceneIndex) ||
    sceneIndex < 0 ||
    !Number.isInteger(particleCount) ||
    particleCount < 1 ||
    particleIndex >= particleCount
  ) {
    throw new RangeError("Particle scene indices are outside their valid range.");
  }
  const ratio =
    SCENE_INDEX_OFFSET_RATIOS[
      sceneIndex % SCENE_INDEX_OFFSET_RATIOS.length
    ];
  const offset = Math.floor(particleCount * ratio);
  return (particleIndex + offset) % particleCount;
}

const PATH_CONTROL_ONE_X = 0;
const PATH_CONTROL_ONE_Y = 1;
const PATH_CONTROL_ONE_Z = 2;
const PATH_CONTROL_TWO_X = 3;
const PATH_CONTROL_TWO_Y = 4;
const PATH_CONTROL_TWO_Z = 5;
const PATH_VORTEX_U_X = 6;
const PATH_VORTEX_U_Y = 7;
const PATH_VORTEX_U_Z = 8;
const PATH_VORTEX_V_X = 9;
const PATH_VORTEX_V_Y = 10;
const PATH_VORTEX_V_Z = 11;
const PATH_VORTEX_RADIUS = 12;
const PATH_VORTEX_TURNS = 13;
const PATH_VORTEX_PHASE = 14;
const PATH_DEPARTURE = 15;
const PATH_ARRIVAL = 16;
const PATH_LANE_DIRECTION = 17;
const PATH_MAX_DEVIATION = 18;
const PATH_VALUE_COUNT = 19;

function transitionPairSeed(seed: number, fromScene: number, toScene: number) {
  return hashUint32(
    (seed >>> 0) ^
      Math.imul((fromScene + 1) >>> 0, 0x27d4eb2d) ^
      Math.imul((toScene + 1) >>> 0, 0x165667b1),
  );
}

function fillPathValues(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  sourceIndex: number,
  fromScene: number,
  toScene: number,
  seed: number,
  emphasis: number,
  maximumExcursion: number,
  output: Float64Array,
) {
  const pairSeed = transitionPairSeed(seed, fromScene, toScene);
  const signal = (stream: number) =>
    coherentHashUnit(pairSeed, sourceIndex, stream);
  // Timing needs more per-dot variation than the spatial lanes. This keeps
  // neighboring particles in the same broad stream without releasing each
  // 96-dot neighborhood as a conspicuous solid clump.
  const timingSignal = (stream: number) =>
    coherentHashUnit(
      pairSeed,
      sourceIndex,
      stream,
      PARTICLE_MOTION_CLUSTER_SIZE,
      0.56,
    );
  const laneDirection = signal(0) < 0.5 ? -1 : 1;
  const fallbackAngle = signal(1) * TAU;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const deltaZ = endZ - startZ;
  const displacement = Math.hypot(deltaX, deltaY, deltaZ);

  let sideX: number;
  let sideY: number;
  let sideZ: number;
  let liftX: number;
  let liftY: number;
  let liftZ: number;
  if (displacement <= 1e-9) {
    sideX = Math.cos(fallbackAngle);
    sideY = Math.sin(fallbackAngle);
    sideZ = 0;
    liftX = -sideY;
    liftY = sideX;
    liftZ = 0;
  } else {
    const axisX = deltaX / displacement;
    const axisY = deltaY / displacement;
    const axisZ = deltaZ / displacement;
    sideX = axisY;
    sideY = -axisX;
    sideZ = 0;
    let sideLength = Math.hypot(sideX, sideY);
    if (sideLength <= 1e-9) {
      sideX = -axisZ;
      sideY = 0;
      sideZ = axisX;
      sideLength = Math.hypot(sideX, sideZ);
    }
    sideX /= sideLength;
    sideY /= sideLength;
    sideZ /= sideLength;
    liftX = sideY * axisZ - sideZ * axisY;
    liftY = sideZ * axisX - sideX * axisZ;
    liftZ = sideX * axisY - sideY * axisX;
    const liftLength = Math.hypot(liftX, liftY, liftZ) || 1;
    liftX /= liftLength;
    liftY /= liftLength;
    liftZ /= liftLength;
    if (liftZ < 0) {
      liftX = -liftX;
      liftY = -liftY;
      liftZ = -liftZ;
    }
  }

  const flightBudget = Math.min(
    maximumExcursion,
    displacement * (0.15 + signal(2) * 0.07),
  );
  const controlOneSide =
    laneDirection * flightBudget * (0.52 + signal(3) * 0.1);
  const controlTwoSide =
    -laneDirection * flightBudget * (0.28 + signal(4) * 0.14);
  const controlOneLift = flightBudget * (0.18 + signal(5) * 0.1);
  const controlTwoLift = flightBudget * (0.24 + signal(6) * 0.08);
  const firstAnchorX = startX + deltaX / 3;
  const firstAnchorY = startY + deltaY / 3;
  const firstAnchorZ = startZ + deltaZ / 3;
  const secondAnchorX = startX + (deltaX * 2) / 3;
  const secondAnchorY = startY + (deltaY * 2) / 3;
  const secondAnchorZ = startZ + (deltaZ * 2) / 3;
  const vortexRadius = flightBudget * (0.12 + signal(7) * 0.06);
  const boundedEmphasis = clampUnit(emphasis / 2);
  const departure = Math.min(
    0.3,
    timingSignal(10) * 0.24 + boundedEmphasis * 0.036,
  );
  const arrivalHold = Math.min(
    0.22,
    timingSignal(11) * 0.16 + boundedEmphasis * 0.036,
  );
  const arrival = Math.max(departure + 0.48, 1 - arrivalHold);
  const firstOffsetLength = Math.hypot(controlOneSide, controlOneLift);
  const secondOffsetLength = Math.hypot(controlTwoSide, controlTwoLift);

  output[PATH_CONTROL_ONE_X] =
    firstAnchorX + sideX * controlOneSide + liftX * controlOneLift;
  output[PATH_CONTROL_ONE_Y] =
    firstAnchorY + sideY * controlOneSide + liftY * controlOneLift;
  output[PATH_CONTROL_ONE_Z] =
    firstAnchorZ + sideZ * controlOneSide + liftZ * controlOneLift;
  output[PATH_CONTROL_TWO_X] =
    secondAnchorX + sideX * controlTwoSide + liftX * controlTwoLift;
  output[PATH_CONTROL_TWO_Y] =
    secondAnchorY + sideY * controlTwoSide + liftY * controlTwoLift;
  output[PATH_CONTROL_TWO_Z] =
    secondAnchorZ + sideZ * controlTwoSide + liftZ * controlTwoLift;
  output[PATH_VORTEX_U_X] = sideX;
  output[PATH_VORTEX_U_Y] = sideY;
  output[PATH_VORTEX_U_Z] = sideZ;
  output[PATH_VORTEX_V_X] = liftX;
  output[PATH_VORTEX_V_Y] = liftY;
  output[PATH_VORTEX_V_Z] = liftZ;
  output[PATH_VORTEX_RADIUS] = vortexRadius;
  output[PATH_VORTEX_TURNS] =
    laneDirection * (0.65 + signal(8) * 0.7);
  output[PATH_VORTEX_PHASE] = signal(9) * TAU;
  output[PATH_DEPARTURE] = departure;
  output[PATH_ARRIVAL] = arrival;
  output[PATH_LANE_DIRECTION] = laneDirection;
  output[PATH_MAX_DEVIATION] =
    Math.max(firstOffsetLength, secondOffsetLength) + vortexRadius;
  return output;
}

/**
 * Builds one reusable, deterministic path. Control points create a broad
 * cubic lane; the orthogonal vortex basis adds spatial flight while retaining
 * exact start/end coordinates.
 */
export function createParticlePathDescriptor(
  start: MotionPoint3,
  end: MotionPoint3,
  options: ParticlePathOptions,
): ParticlePathDescriptor {
  const {
    index,
    fromScene,
    toScene,
    seed = DEFAULT_MOTION_SEED,
    emphasis = 0,
    maximumExcursion = 0.42,
    sourceIndex = index,
    destinationIndex = index,
  } = options;
  if (!Number.isInteger(index) || index < 0) {
    throw new TypeError("Particle index must be a non-negative integer.");
  }
  if (!Number.isInteger(fromScene) || !Number.isInteger(toScene)) {
    throw new TypeError("Scene indices must be integers.");
  }
  if (!Number.isFinite(maximumExcursion) || maximumExcursion < 0) {
    throw new RangeError("Maximum excursion must be a non-negative number.");
  }

  const pathValues = fillPathValues(
    start[0],
    start[1],
    start[2],
    end[0],
    end[1],
    end[2],
    sourceIndex,
    fromScene,
    toScene,
    seed,
    emphasis,
    maximumExcursion,
    new Float64Array(PATH_VALUE_COUNT),
  );
  const departure = pathValues[PATH_DEPARTURE];
  const arrival = pathValues[PATH_ARRIVAL];

  return {
    particleIndex: index,
    sourceIndex,
    destinationIndex,
    start: [start[0], start[1], start[2]],
    controlOne: [
      pathValues[PATH_CONTROL_ONE_X],
      pathValues[PATH_CONTROL_ONE_Y],
      pathValues[PATH_CONTROL_ONE_Z],
    ],
    controlTwo: [
      pathValues[PATH_CONTROL_TWO_X],
      pathValues[PATH_CONTROL_TWO_Y],
      pathValues[PATH_CONTROL_TWO_Z],
    ],
    end: [end[0], end[1], end[2]],
    vortexU: [
      pathValues[PATH_VORTEX_U_X],
      pathValues[PATH_VORTEX_U_Y],
      pathValues[PATH_VORTEX_U_Z],
    ],
    vortexV: [
      pathValues[PATH_VORTEX_V_X],
      pathValues[PATH_VORTEX_V_Y],
      pathValues[PATH_VORTEX_V_Z],
    ],
    vortexRadius: pathValues[PATH_VORTEX_RADIUS],
    vortexTurns: pathValues[PATH_VORTEX_TURNS],
    vortexPhase: pathValues[PATH_VORTEX_PHASE],
    startPhase: departure,
    endPhase: arrival,
    departure,
    arrival,
    laneDirection: pathValues[PATH_LANE_DIRECTION] as -1 | 1,
    maxDeviation: pathValues[PATH_MAX_DEVIATION],
  };
}

function targetPoint(target: ArrayLike<number>, index: number): MotionPoint3 {
  const offset = index * 3;
  return [target[offset], target[offset + 1], target[offset + 2]];
}

/** Precomputes every path for one scene pair; call only when the pair changes. */
export function buildTransitionDescriptors(
  sourceTarget: ArrayLike<number>,
  destinationTarget: ArrayLike<number>,
  options: BuildTransitionDescriptorsOptions,
) {
  const {
    particleCount,
    fromScene,
    toScene,
    seed = DEFAULT_MOTION_SEED,
    sourceEmphasis,
    destinationEmphasis,
    maximumExcursion,
  } = options;
  if (!Number.isInteger(particleCount) || particleCount < 1) {
    throw new RangeError("Particle count must be a positive integer.");
  }
  if (
    sourceTarget.length < particleCount * 3 ||
    destinationTarget.length < particleCount * 3
  ) {
    throw new RangeError("Transition targets do not contain every particle.");
  }

  return Array.from({ length: particleCount }, (_, particleIndex) => {
    const sourceIndex = particleSceneIndex(
      particleIndex,
      fromScene,
      particleCount,
    );
    const destinationIndex = particleSceneIndex(
      particleIndex,
      toScene,
      particleCount,
    );
    const emphasis = Math.max(
      sourceEmphasis?.[sourceIndex] ?? 0,
      destinationEmphasis?.[destinationIndex] ?? 0,
    );
    return createParticlePathDescriptor(
      targetPoint(sourceTarget, sourceIndex),
      targetPoint(destinationTarget, destinationIndex),
      {
        index: particleIndex,
        sourceIndex,
        destinationIndex,
        fromScene,
        toScene,
        seed,
        emphasis,
        maximumExcursion,
      },
    );
  });
}

/** Allocates one reusable struct-of-typed-arrays transition buffer. */
export function createTransitionBuffer(
  particleCount: number,
): ParticleTransitionBuffer {
  if (!Number.isInteger(particleCount) || particleCount < 1) {
    throw new RangeError("Particle count must be a positive integer.");
  }
  const floats = () => new Float32Array(particleCount);
  return {
    count: particleCount,
    sourceIndices: new Uint32Array(particleCount),
    destinationIndices: new Uint32Array(particleCount),
    startX: floats(),
    startY: floats(),
    startZ: floats(),
    controlOneX: floats(),
    controlOneY: floats(),
    controlOneZ: floats(),
    controlTwoX: floats(),
    controlTwoY: floats(),
    controlTwoZ: floats(),
    endX: floats(),
    endY: floats(),
    endZ: floats(),
    vortexUX: floats(),
    vortexUY: floats(),
    vortexUZ: floats(),
    vortexVX: floats(),
    vortexVY: floats(),
    vortexVZ: floats(),
    vortexRadii: floats(),
    vortexTurns: floats(),
    vortexPhases: floats(),
    startPhases: floats(),
    endPhases: floats(),
    laneDirections: new Int8Array(particleCount),
    maxDeviations: floats(),
  };
}

/**
 * Builds paths directly into typed arrays. The one Float64 scratch record is
 * reused for every particle; no intermediate descriptor objects are created.
 */
export function buildTransitionBuffer(
  sourceTarget: ArrayLike<number>,
  destinationTarget: ArrayLike<number>,
  options: BuildTransitionDescriptorsOptions,
  output = createTransitionBuffer(options.particleCount),
) {
  const {
    particleCount,
    fromScene,
    toScene,
    seed = DEFAULT_MOTION_SEED,
    sourceEmphasis,
    destinationEmphasis,
    maximumExcursion = 0.42,
  } = options;
  if (!Number.isInteger(particleCount) || particleCount < 1) {
    throw new RangeError("Particle count must be a positive integer.");
  }
  if (output.count !== particleCount) {
    throw new RangeError("Transition buffer size does not match particle count.");
  }
  if (
    sourceTarget.length < particleCount * 3 ||
    destinationTarget.length < particleCount * 3
  ) {
    throw new RangeError("Transition targets do not contain every particle.");
  }

  const pathValues = new Float64Array(PATH_VALUE_COUNT);
  for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
    const sourceIndex = particleSceneIndex(
      particleIndex,
      fromScene,
      particleCount,
    );
    const destinationIndex = particleSceneIndex(
      particleIndex,
      toScene,
      particleCount,
    );
    const sourceOffset = sourceIndex * 3;
    const destinationOffset = destinationIndex * 3;
    const startX = sourceTarget[sourceOffset];
    const startY = sourceTarget[sourceOffset + 1];
    const startZ = sourceTarget[sourceOffset + 2];
    const endX = destinationTarget[destinationOffset];
    const endY = destinationTarget[destinationOffset + 1];
    const endZ = destinationTarget[destinationOffset + 2];
    const emphasis = Math.max(
      sourceEmphasis?.[sourceIndex] ?? 0,
      destinationEmphasis?.[destinationIndex] ?? 0,
    );
    fillPathValues(
      startX,
      startY,
      startZ,
      endX,
      endY,
      endZ,
      sourceIndex,
      fromScene,
      toScene,
      seed,
      emphasis,
      maximumExcursion,
      pathValues,
    );

    output.sourceIndices[particleIndex] = sourceIndex;
    output.destinationIndices[particleIndex] = destinationIndex;
    output.startX[particleIndex] = startX;
    output.startY[particleIndex] = startY;
    output.startZ[particleIndex] = startZ;
    output.controlOneX[particleIndex] = pathValues[PATH_CONTROL_ONE_X];
    output.controlOneY[particleIndex] = pathValues[PATH_CONTROL_ONE_Y];
    output.controlOneZ[particleIndex] = pathValues[PATH_CONTROL_ONE_Z];
    output.controlTwoX[particleIndex] = pathValues[PATH_CONTROL_TWO_X];
    output.controlTwoY[particleIndex] = pathValues[PATH_CONTROL_TWO_Y];
    output.controlTwoZ[particleIndex] = pathValues[PATH_CONTROL_TWO_Z];
    output.endX[particleIndex] = endX;
    output.endY[particleIndex] = endY;
    output.endZ[particleIndex] = endZ;
    output.vortexUX[particleIndex] = pathValues[PATH_VORTEX_U_X];
    output.vortexUY[particleIndex] = pathValues[PATH_VORTEX_U_Y];
    output.vortexUZ[particleIndex] = pathValues[PATH_VORTEX_U_Z];
    output.vortexVX[particleIndex] = pathValues[PATH_VORTEX_V_X];
    output.vortexVY[particleIndex] = pathValues[PATH_VORTEX_V_Y];
    output.vortexVZ[particleIndex] = pathValues[PATH_VORTEX_V_Z];
    output.vortexRadii[particleIndex] = pathValues[PATH_VORTEX_RADIUS];
    output.vortexTurns[particleIndex] = pathValues[PATH_VORTEX_TURNS];
    output.vortexPhases[particleIndex] = pathValues[PATH_VORTEX_PHASE];
    output.startPhases[particleIndex] = pathValues[PATH_DEPARTURE];
    output.endPhases[particleIndex] = pathValues[PATH_ARRIVAL];
    output.laneDirections[particleIndex] = pathValues[PATH_LANE_DIRECTION];
    output.maxDeviations[particleIndex] = pathValues[PATH_MAX_DEVIATION];
  }
  return output;
}

/** Applies the buffer particle's single timing/easing pass. */
export function resolveTransitionBufferProgress(
  buffer: ParticleTransitionBuffer,
  particleIndex: number,
  transitionProgress: number,
) {
  const bounded = clampUnit(transitionProgress);
  const departure = buffer.startPhases[particleIndex];
  const arrival = buffer.endPhases[particleIndex];
  if (bounded <= departure) return 0;
  if (bounded >= arrival) return 1;
  return smootherstep((bounded - departure) / (arrival - departure));
}

/** Samples one buffer path at an already-eased progress. */
export function sampleTransitionBufferPointAtProgress(
  buffer: ParticleTransitionBuffer,
  particleIndex: number,
  particleProgress: number,
  output: MutableMotionPoint3 = [0, 0, 0],
) {
  const progress = clampUnit(particleProgress);
  if (
    buffer.startX[particleIndex] === buffer.endX[particleIndex] &&
    buffer.startY[particleIndex] === buffer.endY[particleIndex] &&
    buffer.startZ[particleIndex] === buffer.endZ[particleIndex] &&
    buffer.maxDeviations[particleIndex] === 0
  ) {
    output[0] = buffer.startX[particleIndex];
    output[1] = buffer.startY[particleIndex];
    output[2] = buffer.startZ[particleIndex];
    return output;
  }
  if (progress === 0) {
    output[0] = buffer.startX[particleIndex];
    output[1] = buffer.startY[particleIndex];
    output[2] = buffer.startZ[particleIndex];
    return output;
  }
  if (progress === 1) {
    output[0] = buffer.endX[particleIndex];
    output[1] = buffer.endY[particleIndex];
    output[2] = buffer.endZ[particleIndex];
    return output;
  }

  const inverse = 1 - progress;
  const startWeight = inverse * inverse * inverse;
  const firstWeight = 3 * inverse * inverse * progress;
  const secondWeight = 3 * inverse * progress * progress;
  const endWeight = progress * progress * progress;
  const vortexEnvelope = Math.sin(Math.PI * progress);
  const vortexAngle =
    buffer.vortexPhases[particleIndex] +
    buffer.vortexTurns[particleIndex] * TAU * progress;
  const vortexU =
    Math.cos(vortexAngle) *
    buffer.vortexRadii[particleIndex] *
    vortexEnvelope;
  const vortexV =
    Math.sin(vortexAngle) *
    buffer.vortexRadii[particleIndex] *
    vortexEnvelope;

  output[0] =
    buffer.startX[particleIndex] * startWeight +
    buffer.controlOneX[particleIndex] * firstWeight +
    buffer.controlTwoX[particleIndex] * secondWeight +
    buffer.endX[particleIndex] * endWeight +
    buffer.vortexUX[particleIndex] * vortexU +
    buffer.vortexVX[particleIndex] * vortexV;
  output[1] =
    buffer.startY[particleIndex] * startWeight +
    buffer.controlOneY[particleIndex] * firstWeight +
    buffer.controlTwoY[particleIndex] * secondWeight +
    buffer.endY[particleIndex] * endWeight +
    buffer.vortexUY[particleIndex] * vortexU +
    buffer.vortexVY[particleIndex] * vortexV;
  output[2] =
    buffer.startZ[particleIndex] * startWeight +
    buffer.controlOneZ[particleIndex] * firstWeight +
    buffer.controlTwoZ[particleIndex] * secondWeight +
    buffer.endZ[particleIndex] * endWeight +
    buffer.vortexUZ[particleIndex] * vortexU +
    buffer.vortexVZ[particleIndex] * vortexV;
  return output;
}

/** Convenience sampler when the renderer does not separately need progress. */
export function sampleTransitionBufferPoint(
  buffer: ParticleTransitionBuffer,
  particleIndex: number,
  transitionProgress: number,
  output: MutableMotionPoint3 = [0, 0, 0],
) {
  return sampleTransitionBufferPointAtProgress(
    buffer,
    particleIndex,
    resolveTransitionBufferProgress(buffer, particleIndex, transitionProgress),
    output,
  );
}

/** Applies the only easing pass in the path pipeline. */
export function resolveParticlePathProgress(
  descriptor: ParticlePathDescriptor,
  transitionProgress: number,
) {
  const bounded = clampUnit(transitionProgress);
  if (bounded <= descriptor.departure) return 0;
  if (bounded >= descriptor.arrival) return 1;
  return smootherstep(
    (bounded - descriptor.departure) /
      (descriptor.arrival - descriptor.departure),
  );
}

/**
 * Samples a cubic/vortex path at an already-eased particle progress. An output
 * tuple may be reused by the renderer to avoid per-frame allocation.
 */
export function sampleCubicVortexPath(
  descriptor: ParticlePathDescriptor,
  particleProgress: number,
  output: MutableMotionPoint3 = [0, 0, 0],
) {
  const progress = clampUnit(particleProgress);
  if (
    descriptor.maxDeviation === 0 &&
    descriptor.start[0] === descriptor.end[0] &&
    descriptor.start[1] === descriptor.end[1] &&
    descriptor.start[2] === descriptor.end[2]
  ) {
    output[0] = descriptor.start[0];
    output[1] = descriptor.start[1];
    output[2] = descriptor.start[2];
    return output;
  }
  if (progress === 0) {
    output[0] = descriptor.start[0];
    output[1] = descriptor.start[1];
    output[2] = descriptor.start[2];
    return output;
  }
  if (progress === 1) {
    output[0] = descriptor.end[0];
    output[1] = descriptor.end[1];
    output[2] = descriptor.end[2];
    return output;
  }

  const inverse = 1 - progress;
  const startWeight = inverse * inverse * inverse;
  const firstWeight = 3 * inverse * inverse * progress;
  const secondWeight = 3 * inverse * progress * progress;
  const endWeight = progress * progress * progress;
  const vortexEnvelope = Math.sin(Math.PI * progress);
  const vortexAngle =
    descriptor.vortexPhase + descriptor.vortexTurns * TAU * progress;
  const vortexU =
    Math.cos(vortexAngle) * descriptor.vortexRadius * vortexEnvelope;
  const vortexV =
    Math.sin(vortexAngle) * descriptor.vortexRadius * vortexEnvelope;

  output[0] =
    descriptor.start[0] * startWeight +
    descriptor.controlOne[0] * firstWeight +
    descriptor.controlTwo[0] * secondWeight +
    descriptor.end[0] * endWeight +
    descriptor.vortexU[0] * vortexU +
    descriptor.vortexV[0] * vortexV;
  output[1] =
    descriptor.start[1] * startWeight +
    descriptor.controlOne[1] * firstWeight +
    descriptor.controlTwo[1] * secondWeight +
    descriptor.end[1] * endWeight +
    descriptor.vortexU[1] * vortexU +
    descriptor.vortexV[1] * vortexV;
  output[2] =
    descriptor.start[2] * startWeight +
    descriptor.controlOne[2] * firstWeight +
    descriptor.controlTwo[2] * secondWeight +
    descriptor.end[2] * endWeight +
    descriptor.vortexU[2] * vortexU +
    descriptor.vortexV[2] * vortexV;
  return output;
}

/** Convenience sampler for callers that do not also need particle progress. */
export function sampleParticlePath(
  descriptor: ParticlePathDescriptor,
  transitionProgress: number,
  output: MutableMotionPoint3 = [0, 0, 0],
) {
  return sampleCubicVortexPath(
    descriptor,
    resolveParticlePathProgress(descriptor, transitionProgress),
    output,
  );
}

export const sampleTransitionPoint = sampleParticlePath;

/** Frame-rate-independent scalar damping using a time constant in milliseconds. */
export function advanceExponential(
  current: number,
  target: number,
  deltaMs: number,
  timeConstantMs: number,
) {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(target) ||
    !Number.isFinite(deltaMs) ||
    !Number.isFinite(timeConstantMs)
  ) {
    throw new TypeError("Damping inputs must be finite.");
  }
  if (deltaMs <= 0) return current;
  if (timeConstantMs <= 0) return target;
  return target + (current - target) * Math.exp(-deltaMs / timeConstantMs);
}


export const exponentialDamp = advanceExponential;
