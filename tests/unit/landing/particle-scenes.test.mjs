import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildParticleScenes,
  parseParticleAtlas,
  PARTICLE_ATLAS_POINT_COUNT,
  SCENE_COUNT,
  SCENE_PALETTES,
} from "../../../src/features/landing/lib/particle-scenes.ts";

const HEADER_BYTES = 16;
const RECORD_BYTES = 8;
const UNIQUE_TARGET_COUNT = 4;
const POSITION_SCALE = 16_384;

function createAtlasBuffer() {
  const buffer = new ArrayBuffer(
    HEADER_BYTES +
      UNIQUE_TARGET_COUNT * PARTICLE_ATLAS_POINT_COUNT * RECORD_BYTES,
  );
  const view = new DataView(buffer);
  for (const [offset, character] of [..."KPTA"].entries()) {
    view.setUint8(offset, character.charCodeAt(0));
  }
  view.setUint16(4, 1, true);
  view.setUint16(6, UNIQUE_TARGET_COUNT, true);
  view.setUint32(8, PARTICLE_ATLAS_POINT_COUNT, true);
  view.setUint16(12, RECORD_BYTES, true);
  view.setUint16(14, 0, true);

  let offset = HEADER_BYTES;
  for (let scene = 0; scene < UNIQUE_TARGET_COUNT; scene += 1) {
    for (let index = 0; index < PARTICLE_ATLAS_POINT_COUNT; index += 1) {
      // Exercise signed coordinates and atlas quantisation while keeping every
      // fixture point in the renderer's expected world bounds.
      const x = ((index * 97 + scene * 1_003) % 60_001) - 30_000;
      const y = ((index * 193 + scene * 2_009) % 56_001) - 28_000;
      const z = ((index * 47 + scene * 307) % 20_001) - 10_000;
      view.setInt16(offset, x, true);
      view.setInt16(offset + 2, y, true);
      view.setInt16(offset + 4, z, true);
      view.setUint8(offset + 6, (index + scene) % 4);
      view.setUint8(offset + 7, (index * 2 + scene) % 3);
      offset += RECORD_BYTES;
    }
  }
  return buffer;
}

function assertFloatPrefix(shorter, longer) {
  assert.deepEqual(shorter, longer.subarray(0, shorter.length));
}

function particleBounds(target, count) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    minX = Math.min(minX, target[offset]);
    maxX = Math.max(maxX, target[offset]);
    minY = Math.min(minY, target[offset + 1]);
    maxY = Math.max(maxY, target[offset + 1]);
  }
  return { minX, maxX, minY, maxY };
}

test("particle atlas parses all story targets and aliases the final logo", () => {
  const atlas = parseParticleAtlas(createAtlasBuffer());

  assert.equal(atlas.pointCount, PARTICLE_ATLAS_POINT_COUNT);
  assert.equal(atlas.targets.length, SCENE_COUNT);
  assert.equal(atlas.groups.length, SCENE_COUNT);
  assert.equal(atlas.emphasis.length, SCENE_COUNT);
  for (let scene = 0; scene < SCENE_COUNT; scene += 1) {
    assert.equal(atlas.targets[scene].length, PARTICLE_ATLAS_POINT_COUNT * 3);
    assert.equal(atlas.groups[scene].length, PARTICLE_ATLAS_POINT_COUNT);
    assert.equal(atlas.emphasis[scene].length, PARTICLE_ATLAS_POINT_COUNT);
  }

  assert.equal(atlas.targets[0][0], -30_000 / POSITION_SCALE);
  assert.equal(atlas.targets[0][1], -28_000 / POSITION_SCALE);
  assert.equal(atlas.targets[0][2], -10_000 / POSITION_SCALE);
  assert.deepEqual([...atlas.groups[2].subarray(0, 4)], [2, 3, 0, 1]);
  assert.deepEqual([...atlas.emphasis[2].subarray(0, 4)], [2, 1, 0, 2]);

  // Returning to the logo must not introduce even a quantisation-width jump.
  assert.strictEqual(atlas.targets[4], atlas.targets[0]);
  assert.strictEqual(atlas.groups[4], atlas.groups[0]);
  assert.strictEqual(atlas.emphasis[4], atlas.emphasis[0]);
});

test("checked-in production atlas matches its release contract", () => {
  const atlasBytes = readFileSync(
    new URL("../../../public/landing/particle-targets.v1.bin", import.meta.url),
  );
  assert.equal(atlasBytes.byteLength, 640_016);
  assert.equal(
    createHash("sha256").update(atlasBytes).digest("hex"),
    "9018444f038f5c0e6f9bb96ce964a1aaec9a0ef05a4e142ac1d656e8e543f82c",
  );

  const atlasBuffer = atlasBytes.buffer.slice(
    atlasBytes.byteOffset,
    atlasBytes.byteOffset + atlasBytes.byteLength,
  );
  const atlas = parseParticleAtlas(atlasBuffer);
  assert.strictEqual(atlas.targets[4], atlas.targets[0]);
  assert.strictEqual(atlas.groups[4], atlas.groups[0]);
  assert.strictEqual(atlas.emphasis[4], atlas.emphasis[0]);

  for (let scene = 0; scene < UNIQUE_TARGET_COUNT; scene += 1) {
    assert.ok(atlas.groups[scene].every((value) => value <= 3));
    assert.ok(atlas.emphasis[scene].every((value) => value <= 2));
    assert.ok(atlas.targets[scene].every(Number.isFinite));
  }

  // The production atlas stores points in spatial order, so reduced phone
  // tiers must still render every sculpture's full silhouette. Each tier's
  // sampled extent has to stay within one stride of the complete cloud.
  const fullScenes = buildParticleScenes(atlas, PARTICLE_ATLAS_POINT_COUNT);
  for (const count of [4_200, 6_000, 12_000]) {
    const sampled = buildParticleScenes(atlas, count);
    for (let scene = 0; scene < UNIQUE_TARGET_COUNT; scene += 1) {
      const full = particleBounds(
        fullScenes.targets[scene],
        PARTICLE_ATLAS_POINT_COUNT,
      );
      const bounds = particleBounds(sampled.targets[scene], count);
      const fullWidth = full.maxX - full.minX;
      const fullHeight = full.maxY - full.minY;
      assert.ok(
        bounds.maxX - bounds.minX >= fullWidth * 0.95,
        `scene ${scene} at ${count} particles lost horizontal extent`,
      );
      assert.ok(
        bounds.maxY - bounds.minY >= fullHeight * 0.95,
        `scene ${scene} at ${count} particles lost vertical extent`,
      );
    }
  }
});

test("particle atlas rejects incompatible and truncated binary data", () => {
  assert.throws(
    () => parseParticleAtlas(new ArrayBuffer(15)),
    /header is incomplete/,
  );

  const invalidMagic = createAtlasBuffer();
  new DataView(invalidMagic).setUint8(0, "X".charCodeAt(0));
  assert.throws(() => parseParticleAtlas(invalidMagic), /magic is invalid/);

  const invalidVersion = createAtlasBuffer();
  new DataView(invalidVersion).setUint16(4, 2, true);
  assert.throws(
    () => parseParticleAtlas(invalidVersion),
    /Unsupported particle atlas version 2/,
  );

  const invalidTargetCount = createAtlasBuffer();
  new DataView(invalidTargetCount).setUint16(6, 3, true);
  assert.throws(
    () => parseParticleAtlas(invalidTargetCount),
    /target count is invalid/,
  );

  const invalidPointCount = createAtlasBuffer();
  new DataView(invalidPointCount).setUint32(8, 12_000, true);
  assert.throws(
    () => parseParticleAtlas(invalidPointCount),
    /point count is invalid/,
  );

  const invalidRecordSize = createAtlasBuffer();
  new DataView(invalidRecordSize).setUint16(12, 10, true);
  assert.throws(
    () => parseParticleAtlas(invalidRecordSize),
    /record size is invalid/,
  );

  const truncated = createAtlasBuffer().slice(0, -1);
  assert.throws(() => parseParticleAtlas(truncated), /byte length is invalid/);

  const invalidGroup = createAtlasBuffer();
  new DataView(invalidGroup).setUint8(HEADER_BYTES + 6, 4);
  assert.throws(
    () => parseParticleAtlas(invalidGroup),
    /invalid material group/,
  );

  const invalidEmphasis = createAtlasBuffer();
  new DataView(invalidEmphasis).setUint8(HEADER_BYTES + 7, 3);
  assert.throws(
    () => parseParticleAtlas(invalidEmphasis),
    /invalid emphasis level/,
  );
});

test("particle scene construction is deterministic, complete and finite", () => {
  const atlas = parseParticleAtlas(createAtlasBuffer());
  const first = buildParticleScenes(atlas, 512, 1234);
  const second = buildParticleScenes(atlas, 512, 1234);

  assert.equal(first.groups.length, SCENE_COUNT);
  assert.equal(first.emphasis.length, SCENE_COUNT);
  assert.equal(first.introScatter.length, 512 * 3);
  assert.equal(first.targets.length, SCENE_COUNT);
  assert.deepEqual(first.introScatter, second.introScatter);
  assert.ok(first.introScatter.every(Number.isFinite));

  for (let scene = 0; scene < SCENE_COUNT; scene += 1) {
    assert.equal(first.groups[scene].length, 512);
    assert.equal(first.emphasis[scene].length, 512);
    assert.equal(first.targets[scene].length, 512 * 3);
    assert.deepEqual(first.groups[scene], second.groups[scene]);
    assert.deepEqual(first.emphasis[scene], second.emphasis[scene]);
    assert.deepEqual(first.targets[scene], second.targets[scene]);
    assert.ok(first.targets[scene].every(Number.isFinite));
    assert.ok(first.groups[scene].every((value) => value <= 3));
    assert.ok(first.emphasis[scene].every((value) => value <= 2));
    assert.ok(first.targets[scene].every((value) => Math.abs(value) < 2));
  }
});

test("adaptive particle tiers stride the full cloud instead of truncating it", () => {
  const atlas = parseParticleAtlas(createAtlasBuffer());
  const compact = buildParticleScenes(atlas, 7_200, 8844);
  const medium = buildParticleScenes(atlas, 12_000, 8844);
  const full = buildParticleScenes(atlas, 20_000, 8844);

  // Intro scatter is generated per particle index, so prefixes stay stable.
  assertFloatPrefix(compact.introScatter, medium.introScatter);
  assertFloatPrefix(medium.introScatter, full.introScatter);

  // The atlas is stored in spatial order; every reduced tier must be a
  // uniform stride over the complete cloud with aligned groups and emphasis.
  for (const { scenes, count } of [
    { scenes: compact, count: 7_200 },
    { scenes: medium, count: 12_000 },
  ]) {
    for (let scene = 0; scene < SCENE_COUNT; scene += 1) {
      for (const index of [0, 1, 917, count - 1]) {
        const atlasIndex = Math.floor(
          (index * PARTICLE_ATLAS_POINT_COUNT) / count,
        );
        for (let axis = 0; axis < 3; axis += 1) {
          assert.equal(
            scenes.targets[scene][index * 3 + axis],
            atlas.targets[scene][atlasIndex * 3 + axis],
          );
        }
        assert.equal(
          scenes.groups[scene][index],
          atlas.groups[scene][atlasIndex],
        );
        assert.equal(
          scenes.emphasis[scene][index],
          atlas.emphasis[scene][atlasIndex],
        );
      }
    }
  }

  // The full tier keeps the zero-copy identity path.
  for (let scene = 0; scene < SCENE_COUNT; scene += 1) {
    assert.equal(full.targets[scene].length, PARTICLE_ATLAS_POINT_COUNT * 3);
    assert.deepEqual(full.targets[scene], atlas.targets[scene]);
  }
});

test("changing the seed changes only the intro scatter", () => {
  const atlas = parseParticleAtlas(createAtlasBuffer());
  const first = buildParticleScenes(atlas, 512, 1234);
  const second = buildParticleScenes(atlas, 512, 5678);

  assert.notDeepEqual(first.introScatter, second.introScatter);
  assert.deepEqual(first.targets, second.targets);
  assert.deepEqual(first.groups, second.groups);
  assert.deepEqual(first.emphasis, second.emphasis);
});

test("particle scene construction validates adaptive particle counts", () => {
  const atlas = parseParticleAtlas(createAtlasBuffer());
  assert.throws(() => buildParticleScenes(atlas, 0), /between 1 and 20000/);
  assert.throws(() => buildParticleScenes(atlas, 20_001), /between 1 and 20000/);
  assert.throws(() => buildParticleScenes(atlas, 1.5), /between 1 and 20000/);
});

test("scene palettes preserve the four reference-derived material roles", () => {
  assert.equal(SCENE_PALETTES.length, SCENE_COUNT);
  for (const palette of SCENE_PALETTES) assert.equal(palette.length, 4);
  assert.deepEqual(SCENE_PALETTES[0], [
    "#e5ff79",
    "#75d44f",
    "#ff8c2a",
    "#fff6c2",
  ]);
  assert.deepEqual(SCENE_PALETTES[2], [
    "#e5ff79",
    "#75d44f",
    "#ff8c2a",
    "#fff6c2",
  ]);
});
