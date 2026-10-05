export const SCENE_COUNT = 5;
export const PARTICLE_ATLAS_POINT_COUNT = 20_000;
export const PARTICLE_ATLAS_PATH = "/landing/particle-targets.v1.bin";

// Stable colour roles: mint, green, orange, white.
export const SCENE_PALETTES = [
  ["#e5ff79", "#75d44f", "#ff8c2a", "#fff6c2"],
  ["#e5ff79", "#75d44f", "#ff8c2a", "#fff6c2"],
  ["#e5ff79", "#75d44f", "#ff8c2a", "#fff6c2"],
  ["#e5ff79", "#75d44f", "#ff8c2a", "#fff6c2"],
  ["#e5ff79", "#75d44f", "#ff8c2a", "#fff6c2"],
] as const;

export const SCENE_SCALES = [1.02, 0.9, 1.12, 0.92, 1.02] as const;
export const SCENE_COMPACT_SCALE_MULTIPLIERS = [1.18, 1.25, 1.4, 1.12, 1.18] as const;
export const SCENE_DEPTH_STRENGTHS = [0.02, 0.02, 0.62, 0.68, 0.02] as const;

const ATLAS_MAGIC = "KPTA";
const ATLAS_VERSION = 1;
const ATLAS_HEADER_BYTES = 16;
const ATLAS_RECORD_BYTES = 8;
const POSITION_SCALE = 16_384;
const UNIQUE_TARGET_COUNT = 4;

export type ParticleAtlas = {
  pointCount: number;
  groups: readonly Uint8Array[];
  emphasis: readonly Uint8Array[];
  targets: readonly Float32Array[];
};

export type ParticleScenes = {
  groups: readonly Uint8Array[];
  emphasis: readonly Uint8Array[];
  introScatter: Float32Array;
  targets: readonly Float32Array[];
};

function readMagic(view: DataView) {
  return String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
}

export function parseParticleAtlas(buffer: ArrayBuffer): ParticleAtlas {
  const view = new DataView(buffer);
  if (buffer.byteLength < ATLAS_HEADER_BYTES) {
    throw new Error("Particle atlas header is incomplete.");
  }
  if (readMagic(view) !== ATLAS_MAGIC) {
    throw new Error("Particle atlas magic is invalid.");
  }

  const version = view.getUint16(4, true);
  const uniqueTargetCount = view.getUint16(6, true);
  const pointCount = view.getUint32(8, true);
  const recordBytes = view.getUint16(12, true);

  if (version !== ATLAS_VERSION) {
    throw new Error(`Unsupported particle atlas version ${version}.`);
  }
  if (uniqueTargetCount !== UNIQUE_TARGET_COUNT) {
    throw new Error("Particle atlas target count is invalid.");
  }
  if (pointCount !== PARTICLE_ATLAS_POINT_COUNT) {
    throw new Error("Particle atlas point count is invalid.");
  }
  if (recordBytes !== ATLAS_RECORD_BYTES) {
    throw new Error("Particle atlas record size is invalid.");
  }

  const expectedBytes =
    ATLAS_HEADER_BYTES + uniqueTargetCount * pointCount * recordBytes;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error("Particle atlas byte length is invalid.");
  }

  const targets: Float32Array[] = [];
  const groups: Uint8Array[] = [];
  const emphasis: Uint8Array[] = [];
  let byteOffset = ATLAS_HEADER_BYTES;

  for (let scene = 0; scene < uniqueTargetCount; scene += 1) {
    const target = new Float32Array(pointCount * 3);
    const sceneGroups = new Uint8Array(pointCount);
    const sceneEmphasis = new Uint8Array(pointCount);

    for (let index = 0; index < pointCount; index += 1) {
      const targetOffset = index * 3;
      target[targetOffset] = view.getInt16(byteOffset, true) / POSITION_SCALE;
      target[targetOffset + 1] =
        view.getInt16(byteOffset + 2, true) / POSITION_SCALE;
      target[targetOffset + 2] =
        view.getInt16(byteOffset + 4, true) / POSITION_SCALE;
      const group = view.getUint8(byteOffset + 6);
      const pointEmphasis = view.getUint8(byteOffset + 7);
      if (group > 3) {
        throw new Error("Particle atlas contains an invalid material group.");
      }
      if (pointEmphasis > 2) {
        throw new Error("Particle atlas contains an invalid emphasis level.");
      }
      sceneGroups[index] = group;
      sceneEmphasis[index] = pointEmphasis;
      byteOffset += recordBytes;
    }

    targets.push(target);
    groups.push(sceneGroups);
    emphasis.push(sceneEmphasis);
  }

  // The story deliberately returns to the exact first logo target.
  targets.push(targets[0]);
  groups.push(groups[0]);
  emphasis.push(emphasis[0]);

  return { pointCount, targets, groups, emphasis };
}

let atlasPromise: Promise<ParticleAtlas> | null = null;

export function loadParticleAtlas(): Promise<ParticleAtlas> {
  if (!atlasPromise) {
    atlasPromise = fetch(PARTICLE_ATLAS_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Particle atlas request failed with ${response.status}.`,
          );
        }
        return response.arrayBuffer();
      })
      .then(parseParticleAtlas)
      .catch((error: unknown) => {
        // A transient request failure must not poison every later mount in
        // this module lifetime.
        atlasPromise = null;
        throw error;
      });
  }
  return atlasPromise;
}

function hashFloat(value: number) {
  let state = value >>> 0;
  state = Math.imul(state ^ (state >>> 16), 0x7feb352d);
  state = Math.imul(state ^ (state >>> 15), 0x846ca68b);
  state ^= state >>> 16;
  return (state >>> 0) / 4_294_967_296;
}

export function buildParticleScenes(
  atlas: ParticleAtlas,
  count: number,
  seed = 20260824,
): ParticleScenes {
  if (!Number.isInteger(count) || count <= 0 || count > atlas.pointCount) {
    throw new Error(
      `Particle count must be between 1 and ${atlas.pointCount}.`,
    );
  }

  const introScatter = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const angle =
      hashFloat(seed ^ Math.imul(index + 1, 0x9e3779b1)) * Math.PI * 2;
    const radius =
      1.25 +
      hashFloat(seed ^ Math.imul(index + 1, 0x85ebca77)) * 2.55;
    const offset = index * 3;
    introScatter[offset] = Math.cos(angle) * radius;
    introScatter[offset + 1] = Math.sin(angle) * radius * 0.72;
    introScatter[offset + 2] =
      (hashFloat(seed ^ Math.imul(index + 1, 0xc2b2ae3d)) * 2 - 1) * 1.35;
  }

  return {
    groups: atlas.groups.map((values) =>
      sampleSceneBytes(values, atlas.pointCount, count),
    ),
    emphasis: atlas.emphasis.map((values) =>
      sampleSceneBytes(values, atlas.pointCount, count),
    ),
    introScatter,
    targets: atlas.targets.map((values) =>
      sampleSceneTargets(values, atlas.pointCount, count),
    ),
  };
}

// Atlas points are stored in spatial (x-sorted) order, so taking a prefix of
// the cloud amputates every sculpture on reduced-count devices. A uniform
// stride across the full cloud keeps the complete silhouette at any count.
function sampledAtlasIndex(index: number, pointCount: number, count: number) {
  return Math.floor((index * pointCount) / count);
}

function sampleSceneBytes(
  values: Uint8Array,
  pointCount: number,
  count: number,
) {
  if (count === pointCount) return values.subarray(0, count);
  const sampled = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) {
    sampled[index] = values[sampledAtlasIndex(index, pointCount, count)];
  }
  return sampled;
}

function sampleSceneTargets(
  values: Float32Array,
  pointCount: number,
  count: number,
) {
  if (count === pointCount) return values.subarray(0, count * 3);
  const sampled = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const source = sampledAtlasIndex(index, pointCount, count) * 3;
    const destination = index * 3;
    sampled[destination] = values[source];
    sampled[destination + 1] = values[source + 1];
    sampled[destination + 2] = values[source + 2];
  }
  return sampled;
}
