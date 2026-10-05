export type ParticleBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type ParticleFrame = {
  centreX: number;
  centreY: number;
  scale: number;
};

type ResolveParticleFrameOptions = {
  width: number;
  height: number;
  desiredScale: number;
  legacyCentreX: number;
  legacyCentreY: number;
  fromBounds: ParticleBounds;
  toBounds: ParticleBounds;
  transitionProgress: number;
  depthStrength: number;
  safeBottom?: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function measureParticleBounds(target: ArrayLike<number>): ParticleBounds {
  if (target.length < 3 || target.length % 3 !== 0) {
    throw new RangeError("Particle targets must contain complete xyz triples.");
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < target.length; offset += 3) {
    const x = target[offset];
    const y = target[offset + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError("Particle target coordinates must be finite.");
    }
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Keeps portrait and mobile sculptures inside the area that is actually
 * visible above the story copy. Wide landscape screens retain the original
 * art-directed camera exactly.
 */
export function resolveParticleFrame({
  width,
  height,
  desiredScale,
  legacyCentreX,
  legacyCentreY,
  fromBounds,
  toBounds,
  transitionProgress,
  depthStrength,
  safeBottom: requestedSafeBottom,
}: ResolveParticleFrameOptions): ParticleFrame {
  const constrainedPortrait =
    width < 900 || (width < 1_180 && height > width * 1.15);
  if (!constrainedPortrait) {
    return {
      centreX: legacyCentreX,
      centreY: legacyCentreY,
      scale: desiredScale,
    };
  }

  const progress = clamp01(transitionProgress);
  const flightEnvelope = Math.sin(Math.PI * progress);
  const modelMinX = Math.min(fromBounds.minX, toBounds.minX);
  const modelMaxX = Math.max(fromBounds.maxX, toBounds.maxX);
  const modelMinY = Math.min(fromBounds.minY, toBounds.minY);
  const modelMaxY = Math.max(fromBounds.maxY, toBounds.maxY);

  // Cubic lanes can leave the static target bounds. Pulling the camera back
  // during flight preserves that motion without letting it leave the frame.
  const flightPadding = 0.06 + flightEnvelope * 0.38;
  const perspectiveMargin =
    1 + Math.min(1, Math.max(0, depthStrength)) * 0.04 + flightEnvelope * 0.1;
  const modelWidth = modelMaxX - modelMinX + flightPadding * 2;
  const modelHeight = modelMaxY - modelMinY + flightPadding * 2;

  const horizontalInset = Math.max(18, width * 0.055);
  const safeLeft = horizontalInset;
  const safeRight = width - horizontalInset;
  const safeTop = width < 760 ? 76 : 88;
  const safeBottom = Math.max(
    safeTop + 120,
    Math.min(height * 0.6, requestedSafeBottom ?? height * 0.6),
  );
  const safeWidth = Math.max(1, safeRight - safeLeft);
  const safeHeight = Math.max(1, safeBottom - safeTop);
  const fitScale = Math.min(
    (safeWidth * 0.96) / Math.max(0.001, modelWidth * perspectiveMargin),
    (safeHeight * 0.94) / Math.max(0.001, modelHeight * perspectiveMargin),
  );
  const scale = Math.min(desiredScale, fitScale);

  const modelCentreX = (modelMinX + modelMaxX) * 0.5;
  const modelCentreY = (modelMinY + modelMaxY) * 0.5;
  const frameCentreX = (safeLeft + safeRight) * 0.5;
  const frameCentreY = (safeTop + safeBottom) * 0.5;

  return {
    centreX: frameCentreX - modelCentreX * scale,
    centreY: frameCentreY + modelCentreY * scale,
    scale,
  };
}
