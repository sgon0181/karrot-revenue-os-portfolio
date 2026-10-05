export type ParticleQualityInput = {
  width: number;
  devicePixelRatio: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
};

export type ParticleQuality = {
  particleCount: number;
  pixelRatio: number;
  minimumFrameInterval: number;
  backgroundParticleCount: number;
  tier: "constrained" | "balanced" | "high";
};

const clampPixelRatio = (value: number, maximum: number) =>
  Math.max(1, Math.min(Number.isFinite(value) ? value : 1, maximum));

/**
 * Keeps the dense reference treatment on capable desktops while putting a
 * firm ceiling on compact and resource-constrained devices. Browser hardware
 * hints are deliberately optional because Safari does not expose all of them.
 */
export function resolveParticleQuality({
  width,
  devicePixelRatio,
  deviceMemory,
  hardwareConcurrency,
  saveData = false,
}: ParticleQualityInput): ParticleQuality {
  const compact = width < 640;
  const tablet = width >= 640 && width < 960;
  const constrained =
    saveData ||
    (deviceMemory !== undefined && deviceMemory <= 4) ||
    (hardwareConcurrency !== undefined && hardwareConcurrency <= 4);
  const high =
    !compact &&
    !tablet &&
    !constrained &&
    (deviceMemory === undefined || deviceMemory >= 8) &&
    (hardwareConcurrency === undefined || hardwareConcurrency > 8);

  if (constrained) {
    return {
      particleCount: compact ? 4_200 : tablet ? 6_500 : 10_000,
      pixelRatio: clampPixelRatio(devicePixelRatio, compact ? 1 : 1.15),
      minimumFrameInterval: 1000 / (compact ? 24 : 30),
      backgroundParticleCount: compact ? 160 : tablet ? 260 : 420,
      tier: "constrained",
    };
  }

  if (!high) {
    return {
      particleCount: compact ? 6_000 : tablet ? 9_000 : 16_000,
      pixelRatio: clampPixelRatio(devicePixelRatio, compact ? 1.25 : tablet ? 1.25 : 1.35),
      minimumFrameInterval: 1000 / (compact ? 30 : tablet ? 40 : 45),
      backgroundParticleCount: compact ? 280 : tablet ? 480 : 850,
      tier: "balanced",
    };
  }

  return {
    particleCount: 20_000,
    pixelRatio: clampPixelRatio(devicePixelRatio, 1.5),
    minimumFrameInterval: 0,
    backgroundParticleCount: 1_200,
    tier: "high",
  };
}
