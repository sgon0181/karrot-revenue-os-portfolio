"use client";

import { useEffect, useRef } from "react";
import {
  advanceExponential,
  buildTransitionBuffer,
  COMPACT_SCENE_HOLD,
  DEFAULT_SCENE_HOLD,
  particleSceneIndex,
  resolveChapterScrollProgress,
  resolveTransitionPhase,
  resolveTransitionBufferProgress,
  sampleTransitionBufferPointAtProgress,
  type MutableMotionPoint3,
  type ParticleTransitionBuffer,
} from "@/features/landing/lib/particle-motion";
import {
  buildParticleScenes,
  loadParticleAtlas,
  SCENE_COMPACT_SCALE_MULTIPLIERS,
  SCENE_DEPTH_STRENGTHS,
  SCENE_PALETTES,
  SCENE_SCALES,
  type ParticleAtlas,
  type ParticleScenes,
} from "@/features/landing/lib/particle-scenes";
import {
  resolveParticleQuality,
  type ParticleQuality,
} from "@/features/landing/lib/particle-quality";
import {
  measureParticleBounds,
  resolveParticleFrame,
  type ParticleBounds,
} from "@/features/landing/lib/particle-framing";

type BokehPoint = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  rise: number;
  direction: number;
  alpha: number;
  tier: number;
  tone: 0 | 1 | 2;
};

const DEPTH_BANDS = 9;
const MATERIAL_BANDS = 3;

type ProjectionCamera = {
  centreX: number;
  centreY: number;
  scale: number;
  cosineYaw: number;
  sineYaw: number;
  cosinePitch: number;
  sinePitch: number;
  depthStrength: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function smoothstep(value: number) {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function smootherstep(value: number) {
  const bounded = clamp(value);
  return bounded * bounded * bounded * (bounded * (bounded * 6 - 15) + 10);
}

function parseHex(hex: string) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ] as const;
}

function mixColour(from: string, to: string, progress: number, alpha: number) {
  const first = parseHex(from);
  const second = parseHex(to);
  const red = Math.round(first[0] + (second[0] - first[0]) * progress);
  const green = Math.round(first[1] + (second[1] - first[1]) * progress);
  const blue = Math.round(first[2] + (second[2] - first[2]) * progress);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function createBokeh(count: number): BokehPoint[] {
  let seed = 4189;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: count }, () => {
    const tierRoll = random();
    const tier = tierRoll < 0.84 ? 0 : tierRoll < 0.975 ? 1 : 2;
    const toneRoll = random();
    const ribbonRoll = random();
    let x = random();
    let y = random();
    if (ribbonRoll < 0.34) {
      const angle = random() * Math.PI * 2;
      const radius = 0.22 + random() * 0.2;
      x = clamp(0.7 + Math.cos(angle) * radius * 1.45, 0.01, 0.99);
      y = clamp(0.47 + Math.sin(angle) * radius * 0.76 + (random() - 0.5) * 0.045, 0.01, 0.99);
    } else if (ribbonRoll < 0.5) {
      x = random();
      y = clamp(0.48 + Math.sin(x * Math.PI * 2 + 0.8) * 0.2 + (random() - 0.5) * 0.09, 0.01, 0.99);
    }
    return {
      x,
      y,
      radius: tier === 0 ? 0.28 + random() * 0.72 : tier === 1 ? 0.9 + random() * 1.5 : 2.8 + random() * 4.8,
      speed: tier === 0 ? 0.015 + random() * 0.045 : 0.035 + random() * 0.11,
      rise: 0.01 + random() * (tier === 2 ? 0.08 : 0.04),
      direction: random() < 0.5 ? -1 : 1,
      alpha: tier === 0 ? 0.09 + random() * 0.17 : tier === 1 ? 0.05 + random() * 0.1 : 0.016 + random() * 0.03,
      tier,
      tone: toneRoll < 0.66 ? 0 : toneRoll < 0.9 ? 1 : 2,
    };
  });
}

export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bokeh = createBokeh(1200);
    let reducedMotion = reducedMotionQuery.matches;
    let introStartedAt = 0;
    let lastFrameAt = 0;
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let quality: ParticleQuality = resolveParticleQuality({
      width,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
    let particleCount = 0;
    let atlas: ParticleAtlas | null = null;
    let scenes: ParticleScenes | null = null;
    let sceneBounds: ParticleBounds[] = [];
    let sceneCopyHeights: number[] = [];
    let projectedX = new Float32Array(0);
    let projectedY = new Float32Array(0);
    let projectedScale = new Float32Array(0);
    const renderBuckets = Array.from(
      { length: DEPTH_BANDS * 3 * 4 * 4 * MATERIAL_BANDS },
      () => [] as number[],
    );
    let transitionBuffer: ParticleTransitionBuffer | null = null;
    let transitionFromScene = -1;
    let transitionToScene = -1;
    let transitionParticleCount = -1;
    let transitionMaximumExcursion = -1;
    const transitionBufferCache = new Map<string, ParticleTransitionBuffer>();
    const sampledPoint: MutableMotionPoint3 = [0, 0, 0];
    let targetProgress = 0;
    let renderedProgress = targetProgress;
    let pointerX = 0;
    let pointerY = 0;
    let renderedPointerX = 0;
    let renderedPointerY = 0;
    let pointerClientX = 0;
    let pointerClientY = 0;
    let renderedPointerClientX = 0;
    let renderedPointerClientY = 0;
    let pointerPresence = 0;
    let renderedPointerPresence = 0;
    let targetScrollVelocity = 0;
    let renderedScrollVelocity = 0;
    let lastScrollY = window.scrollY;
    let lastScrollAt = 0;
    let spaceTravel = 0;
    let animationFrame = 0;
    let lastPaintAt = 0;
    let slowFrameScore = 0;
    let forceConstrainedQuality = false;
    let documentVisible = !document.hidden;
    let disposed = false;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, bounds.width);
      const nextHeight = Math.max(1, bounds.height);
      sceneCopyHeights = Array.from(
        canvas.closest("main")?.querySelectorAll<HTMLElement>("[data-landing-copy]") ?? [],
        (copy) => copy.getBoundingClientRect().height,
      );
      const runtimeNavigator = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { saveData?: boolean };
      };
      const nextQuality = resolveParticleQuality({
        width: nextWidth,
        devicePixelRatio: window.devicePixelRatio || 1,
        deviceMemory: runtimeNavigator.deviceMemory,
        hardwareConcurrency: runtimeNavigator.hardwareConcurrency,
        saveData:
          forceConstrainedQuality || runtimeNavigator.connection?.saveData,
      });
      const nextCanvasWidth = Math.round(nextWidth * nextQuality.pixelRatio);
      const nextCanvasHeight = Math.round(nextHeight * nextQuality.pixelRatio);
      const bitmapChanged =
        canvas.width !== nextCanvasWidth || canvas.height !== nextCanvasHeight;

      width = nextWidth;
      height = nextHeight;
      quality = nextQuality;
      pixelRatio = quality.pixelRatio;
      if (bitmapChanged) {
        canvas.width = nextCanvasWidth;
        canvas.height = nextCanvasHeight;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }

      const nextCount = quality.particleCount;
      if (nextCount !== particleCount) {
        particleCount = nextCount;
        scenes = atlas ? buildParticleScenes(atlas, particleCount) : null;
        sceneBounds = scenes
          ? scenes.targets.map(measureParticleBounds)
          : [];
        projectedX = new Float32Array(particleCount);
        projectedY = new Float32Array(particleCount);
        projectedScale = new Float32Array(particleCount);
        transitionFromScene = -1;
        transitionToScene = -1;
        transitionParticleCount = -1;
        transitionMaximumExcursion = -1;
        transitionBuffer = null;
        transitionBufferCache.clear();
      }

      if (renderedPointerClientX === 0 && renderedPointerClientY === 0) {
        renderedPointerClientX = width * 0.7;
        renderedPointerClientY = height * 0.5;
        pointerClientX = renderedPointerClientX;
        pointerClientY = renderedPointerClientY;
      }

      // Repaint only when the backing bitmap genuinely changes. Mobile browser
      // chrome can emit repeated resize notifications with identical geometry.
      if (bitmapChanged && scenes) {
        lastFrameAt = 0;
        lastPaintAt = 0;
        redrawRef.current?.();
      }
    };

    const readScrollProgress = () => {
      const story = canvas.closest("main");
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const now = performance.now();
      const scrollY = window.scrollY;
      if (!reducedMotion && lastScrollAt > 0) {
        const elapsed = Math.max(8, now - lastScrollAt);
        const viewportsPerSecond =
          ((scrollY - lastScrollY) / elapsed) *
          (1000 / Math.max(height, 1));
        targetScrollVelocity = clamp(viewportsPerSecond, -4.5, 4.5);
      }
      lastScrollY = scrollY;
      lastScrollAt = now;
      if (reducedMotion) {
        targetProgress = 1;
      } else {
        const sections = story
          ? Array.from(story.querySelectorAll<HTMLElement>("section[id]"))
          : [];
        if (sections.length > 1) {
          const viewportAnchor = scrollY + viewportHeight * 0.5;
          const sceneAnchors = sections.map((section) => {
            const sectionTop = section.getBoundingClientRect().top + scrollY;
            return sectionTop + Math.min(section.offsetHeight, viewportHeight) * 0.5;
          });
          targetProgress = resolveChapterScrollProgress(
            viewportAnchor,
            sceneAnchors,
          );
        } else {
          const storyStart = story
            ? story.getBoundingClientRect().top + scrollY
            : 0;
          const scrollable = Math.max(
            1,
            (story?.scrollHeight ?? document.documentElement.scrollHeight) - viewportHeight,
          );
          targetProgress = clamp((scrollY - storyStart) / scrollable);
        }
      }
      if (reducedMotion) redrawRef.current?.();
    };

    const readPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const isMobile = width < 900;
      const isCompact = width < 640;
      const centreX = width * (isMobile ? 0.5 : 0.7);
      const centreY = height * (isCompact ? 0.31 : isMobile ? 0.38 : 0.51);
      pointerClientX = event.clientX;
      pointerClientY = event.clientY;
      pointerX = clamp((event.clientX - centreX) / Math.max(width * 0.36, 1), -1, 1);
      pointerY = clamp((event.clientY - centreY) / Math.max(height * 0.42, 1), -1, 1);
      pointerPresence = 1;
    };

    const clearPointer = () => {
      pointerX = 0;
      pointerY = 0;
      pointerPresence = 0;
    };

    const createProjectionCamera = (
      sceneScale: number,
      fromBounds: ParticleBounds,
      toBounds: ParticleBounds,
      transitionProgress: number,
      safeBottom: number | undefined,
      pointPointerX = renderedPointerX,
      pointPointerY = renderedPointerY,
      verticalOffset = 0,
      depthStrength = 0,
      time = 0,
    ): ProjectionCamera => {
      const isMobile = width < 900;
      const isCompact = width < 640;
      const centreX = width * (isMobile ? 0.5 : 0.7);
      const centreY = height * (isCompact ? 0.31 : isMobile ? 0.38 : 0.51);
      const baseScale = Math.min(width * (isMobile ? 0.3 : 0.25), height * (isMobile ? 0.27 : 0.34));
      const idleYaw = Math.sin(time * 0.00034) * 0.04 * depthStrength;
      const yaw = pointPointerX * 0.04 * depthStrength + idleYaw;
      const pitch = pointPointerY * 0.026 * depthStrength + Math.cos(time * 0.00027) * 0.018 * depthStrength;
      const frame = resolveParticleFrame({
        width,
        height,
        desiredScale: baseScale * sceneScale,
        legacyCentreX: centreX,
        legacyCentreY: centreY + verticalOffset,
        fromBounds,
        toBounds,
        transitionProgress,
        depthStrength,
        safeBottom,
      });
      return {
        centreX: frame.centreX,
        centreY: frame.centreY,
        scale: frame.scale,
        cosineYaw: Math.cos(yaw),
        sineYaw: Math.sin(yaw),
        cosinePitch: Math.cos(pitch),
        sinePitch: Math.sin(pitch),
        depthStrength,
      };
    };

    const drawBackgroundParticles = (time: number, scrollEnergy: number) => {
      context.save();
      const visibleCount = quality.backgroundParticleCount;
      for (let index = 0; index < visibleCount; index += 1) {
        const point = bokeh[index];
        const drift = time * point.speed * 0.000018 * point.direction;
        const depthTravel = spaceTravel * (0.08 + point.tier * 0.18);
        const x = ((point.x + drift + depthTravel * point.direction * 0.12) % 1 + 1) % 1 * width;
        const orbit = Math.sin(time * (0.00011 + point.tier * 0.00004) + point.x * 9) * (0.008 + point.tier * 0.008);
        const rise = time * point.rise * 0.000012;
        const y = (((point.y - rise + orbit + depthTravel) % 1 + 1) % 1) * height;
        context.beginPath();
        context.fillStyle = point.tier === 2
          ? `rgba(117, 212, 79, ${point.alpha})`
          : point.tone === 0
            ? `rgba(229, 255, 121, ${point.alpha})`
            : point.tone === 1
              ? `rgba(255, 246, 194, ${point.alpha * 0.9})`
              : `rgba(255, 140, 42, ${point.alpha * 0.68})`;
        const stretch = 1 + scrollEnergy * (0.25 + point.tier * 0.9);
        context.ellipse(
          x,
          y,
          point.radius * (1 + scrollEnergy * 0.08),
          point.radius * stretch,
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      context.restore();
    };

    const draw = (time: number) => {
      if (!scenes) return;
      if (
        !reducedMotion &&
        quality.minimumFrameInterval > 0 &&
        lastPaintAt > 0 &&
        time - lastPaintAt < quality.minimumFrameInterval
      ) {
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }
      lastPaintAt = time;
      const paintStartedAt = performance.now();
      const frameDelta = lastFrameAt === 0 ? 16.67 : Math.min(64, Math.max(1, time - lastFrameAt));
      lastFrameAt = time;
      const introDuration = width < 640 ? 900 : 1800;
      const introClock = reducedMotion || introStartedAt === 0
        ? Number(reducedMotion)
        : clamp((time - introStartedAt) / introDuration);

      if (time - lastScrollAt > 44) {
        targetScrollVelocity = advanceExponential(
          targetScrollVelocity,
          0,
          frameDelta,
          115,
        );
      }
      renderedScrollVelocity = reducedMotion
        ? 0
        : advanceExponential(
          renderedScrollVelocity,
          targetScrollVelocity,
          frameDelta,
          74,
        );
      const scrollEnergy = clamp(Math.abs(renderedScrollVelocity) / 3.2);
      spaceTravel += renderedScrollVelocity * frameDelta * 0.000105;
      renderedProgress = reducedMotion
        ? targetProgress
        : advanceExponential(renderedProgress, targetProgress, frameDelta, 78);
      renderedPointerX = advanceExponential(
        renderedPointerX,
        pointerX,
        frameDelta,
        210,
      );
      renderedPointerY = advanceExponential(
        renderedPointerY,
        pointerY,
        frameDelta,
        210,
      );
      renderedPointerClientX = advanceExponential(
        renderedPointerClientX,
        pointerClientX,
        frameDelta,
        90,
      );
      renderedPointerClientY = advanceExponential(
        renderedPointerClientY,
        pointerClientY,
        frameDelta,
        90,
      );
      renderedPointerPresence = reducedMotion
        ? 0
        : advanceExponential(
          renderedPointerPresence,
          pointerPresence,
          frameDelta,
          pointerPresence ? 95 : 185,
        );
      canvas.parentElement?.style.setProperty(
        "--dawn",
        smoothstep((renderedProgress - 0.72) / 0.28).toFixed(3),
      );

      // The 760px boundary mirrors the stylesheet: below it, chapter copy is a
      // fixed overlay and each sculpture must stay settled while its copy shows.
      const phase = resolveTransitionPhase(
        renderedProgress,
        scenes.targets.length,
        width < 760 ? COMPACT_SCENE_HOLD : DEFAULT_SCENE_HOLD,
      );
      const { fromScene, toScene, transitionProgress } = phase;
      const fromTarget = scenes.targets[fromScene];
      const toTarget = scenes.targets[toScene];
      const fromGroups = scenes.groups[fromScene];
      const toGroups = scenes.groups[toScene];
      const fromEmphasis = scenes.emphasis[fromScene];
      const toEmphasis = scenes.emphasis[toScene];

      if (
        fromScene !== toScene &&
        (transitionFromScene !== fromScene ||
          transitionToScene !== toScene ||
          transitionParticleCount !== particleCount ||
          transitionMaximumExcursion !== (width < 900 ? 0.34 : 0.6))
      ) {
        const maximumExcursion = width < 900 ? 0.34 : 0.6;
        const descriptorKey = `${particleCount}:${maximumExcursion}:${fromScene}:${toScene}`;
        const cachedBuffer = transitionBufferCache.get(descriptorKey);
        transitionBuffer = cachedBuffer ?? buildTransitionBuffer(
          fromTarget,
          toTarget,
          {
            particleCount,
            fromScene,
            toScene,
            sourceEmphasis: fromEmphasis,
            destinationEmphasis: toEmphasis,
            maximumExcursion,
          },
        );
        if (!cachedBuffer) {
          transitionBufferCache.set(descriptorKey, transitionBuffer);
          if (transitionBufferCache.size > 2) {
            const oldestKey = transitionBufferCache.keys().next().value;
            if (oldestKey) transitionBufferCache.delete(oldestKey);
          }
        }
        transitionFromScene = fromScene;
        transitionToScene = toScene;
        transitionParticleCount = particleCount;
        transitionMaximumExcursion = maximumExcursion;
      }

      const sceneMix = smoothstep(transitionProgress);
      const flightEnvelope = fromScene === toScene
        ? 0
        : Math.sin(Math.PI * transitionProgress);
      const settledStrength = fromScene === toScene
        ? 1
        : 1 - smoothstep(flightEnvelope);
      const scrollSuppression = 1 - smoothstep(clamp(scrollEnergy * 1.45));
      const interactionStrength =
        renderedPointerPresence * scrollSuppression * settledStrength;
      const fromScale =
        SCENE_SCALES[fromScene] *
        (width < 640 ? SCENE_COMPACT_SCALE_MULTIPLIERS[fromScene] : 1);
      const toScale =
        SCENE_SCALES[toScene] *
        (width < 640 ? SCENE_COMPACT_SCALE_MULTIPLIERS[toScene] : 1);
      const sceneScale =
        (fromScale + (toScale - fromScale) * sceneMix) *
        (1 + flightEnvelope * 0.11);
      const fromDepthStrength = SCENE_DEPTH_STRENGTHS[fromScene];
      const toDepthStrength = SCENE_DEPTH_STRENGTHS[toScene];
      const depthStrength = Math.max(
        fromDepthStrength + (toDepthStrength - fromDepthStrength) * sceneMix,
        flightEnvelope * 0.94,
      );
      const finaleLift = width < 760
        ? -height * 0.05 * smoothstep((renderedProgress - 0.78) / 0.2)
        : 0;
      const idleFloat = reducedMotion
        ? 0
        : Math.sin(time * 0.00048) * height * 0.0045 * settledStrength * depthStrength;
      const fromCopyHeight = sceneCopyHeights[fromScene] ?? 0;
      const toCopyHeight = sceneCopyHeights[toScene] ?? fromCopyHeight;
      const copyHeight = fromCopyHeight + (toCopyHeight - fromCopyHeight) * sceneMix;
      const safeBottom = width < 900 || height > width * 1.15
        ? height - copyHeight - Math.max(28, height * 0.055) - 14
        : undefined;
      const camera = createProjectionCamera(
        sceneScale,
        sceneBounds[fromScene],
        sceneBounds[toScene],
        transitionProgress,
        safeBottom,
        reducedMotion ? 0 : renderedPointerX * interactionStrength,
        reducedMotion ? 0 : renderedPointerY * interactionStrength,
        finaleLift + idleFloat,
        depthStrength,
        reducedMotion ? 0 : time,
      );

      context.clearRect(0, 0, width, height);
      drawBackgroundParticles(time, scrollEnergy);
      const sizes = [0.58, 0.88, 1.24] as const;
      const alphas = [0.58, 0.92, 1] as const;
      for (const bucket of renderBuckets) bucket.length = 0;

      const hoverStrength = interactionStrength;
      const hoverRadius = clamp(Math.min(width, height) * 0.15, 78, 132);
      const hoverRadiusSquared = hoverRadius * hoverRadius;
      const {
        centreX,
        centreY,
        scale: cameraScale,
        cosineYaw,
        sineYaw,
        cosinePitch,
        sinePitch,
      } = camera;

      // Projection is the expensive part of the frame. Cache it once per
      // particle and bucket the particle once, then draw every bucket once.
      for (let index = 0; index < particleCount; index += 1) {
        const scatterOffset = index * 3;
        let sourceIndex: number;
        let destinationIndex: number;
        let pointProgress = 0;
        let targetX: number;
        let targetY: number;
        let targetZ: number;

        if (fromScene === toScene) {
          sourceIndex = particleSceneIndex(index, fromScene, particleCount);
          destinationIndex = sourceIndex;
          const targetOffset = sourceIndex * 3;
          targetX = fromTarget[targetOffset];
          targetY = fromTarget[targetOffset + 1];
          targetZ = fromTarget[targetOffset + 2];
        } else {
          if (!transitionBuffer) continue;
          sourceIndex = transitionBuffer.sourceIndices[index];
          destinationIndex = transitionBuffer.destinationIndices[index];
          pointProgress = resolveTransitionBufferProgress(
            transitionBuffer,
            index,
            transitionProgress,
          );
          sampleTransitionBufferPointAtProgress(
            transitionBuffer,
            index,
            pointProgress,
            sampledPoint,
          );
          targetX = sampledPoint[0];
          targetY = sampledPoint[1];
          targetZ = sampledPoint[2];
        }

        const travel = Math.sin(pointProgress * Math.PI);
        const introDelay = Math.abs(Math.sin(index * 0.713 + 1.17)) * 0.18;
        const introProgress = reducedMotion
          ? 1
          : smootherstep(clamp((introClock - introDelay) / (1 - introDelay)));
        const introTravel = Math.sin(introProgress * Math.PI);
        const scatterX = scenes.introScatter[scatterOffset];
        const scatterY = scenes.introScatter[scatterOffset + 1];
        const scatterZ = scenes.introScatter[scatterOffset + 2];
        const x = scatterX + (targetX - scatterX) * introProgress
          - scatterY * introTravel * 0.055;
        const y = scatterY + (targetY - scatterY) * introProgress
          + scatterX * introTravel * 0.055;
        const z = scatterZ + (targetZ - scatterZ) * introProgress
          + introTravel * 0.24
          + renderedScrollVelocity * travel * 0.032;

        const rotatedX = x * cosineYaw - z * sineYaw;
        const yawDepth = x * sineYaw + z * cosineYaw;
        const rotatedY = y * cosinePitch - yawDepth * sinePitch;
        const rotatedZ = y * sinePitch + yawDepth * cosinePitch;
        const perspective = clamp(1 + rotatedZ * 0.2 * depthStrength, 0.76, 1.32);
        let screenX = centreX + rotatedX * cameraScale * perspective;
        let screenY = centreY - rotatedY * cameraScale * perspective;

        if (hoverStrength > 0.005) {
          const pointerDeltaX = screenX - renderedPointerClientX;
          const pointerDeltaY = screenY - renderedPointerClientY;
          const pointerDistanceSquared =
            pointerDeltaX * pointerDeltaX + pointerDeltaY * pointerDeltaY;
          if (pointerDistanceSquared < hoverRadiusSquared) {
            const pointerDistance = Math.sqrt(pointerDistanceSquared) || 1;
            const influence =
              (1 - pointerDistance / hoverRadius) ** 2 * hoverStrength;
            const push = 13 * influence * perspective;
            screenX += (pointerDeltaX / pointerDistance) * push
              - (pointerDeltaY / pointerDistance) * influence * 1.8;
            screenY += (pointerDeltaY / pointerDistance) * push
              + (pointerDeltaX / pointerDistance) * influence * 1.8;
          }
        }

        const depthPosition = depthStrength < 0.1
          ? 0.72
          : clamp(0.5 + (rotatedZ * depthStrength) / (0.08 + depthStrength * 0.14));
        const depthBand = Math.min(
          DEPTH_BANDS - 1,
          Math.floor(depthPosition * DEPTH_BANDS),
        );
        const emphasis = Math.round(
          fromEmphasis[sourceIndex] +
          (toEmphasis[destinationIndex] - fromEmphasis[sourceIndex]) * pointProgress,
        );
        const particleGrain = 0.88 + (((index * 37) % 101) / 101) * 0.24;
        const landmarkBoost = emphasis === 2 && index % 79 === 0 ? 1.55 : 1;
        const depthRatio = depthBand / Math.max(1, DEPTH_BANDS - 1);
        const bandScale = 0.72 + depthRatio * 0.44;
        // Let the nearest travelling particles bloom towards the camera. The
        // settled sculptures stay pixel-identical because `travel` is zero at
        // both ends of every transition.
        const nearDepth = Math.max(0, (depthRatio - 0.48) / 0.52);
        const flightDepthScale =
          (1 - travel * 0.08) * (1 + travel * nearDepth * 0.44);
        const arrivalShimmer = emphasis === 2 && pointProgress > 0.84
          ? 1 + Math.sin(((pointProgress - 0.84) / 0.16) * Math.PI) * 0.08
          : 1;
        projectedX[index] = screenX;
        projectedY[index] = screenY;
        projectedScale[index] =
          landmarkBoost * particleGrain * flightDepthScale * arrivalShimmer * perspective * bandScale;
        const materialBand = Math.min(
          MATERIAL_BANDS - 1,
          Math.round(pointProgress * (MATERIAL_BANDS - 1)),
        );
        const bucketIndex =
          (((((depthBand * 3 + emphasis) * 4 + fromGroups[sourceIndex]) * 4) +
            toGroups[destinationIndex]) * MATERIAL_BANDS) + materialBand;
        renderBuckets[bucketIndex].push(index);
      }

      context.save();
      context.globalCompositeOperation = "source-over";
      // Back-to-front depth bands let both volumetric sculptures occlude
      // themselves. Material-pair batching keeps each individual dot's colour
      // continuous as it travels between semantically different scenes.
      for (let depthBand = 0; depthBand < DEPTH_BANDS; depthBand += 1) {
        for (let emphasis = 0; emphasis < 3; emphasis += 1) {
          for (let fromGroup = 0; fromGroup < 4; fromGroup += 1) {
            for (let toGroup = 0; toGroup < 4; toGroup += 1) {
              for (let materialBand = 0; materialBand < MATERIAL_BANDS; materialBand += 1) {
                const bucketIndex =
                  (((((depthBand * 3 + emphasis) * 4 + fromGroup) * 4) +
                    toGroup) * MATERIAL_BANDS) + materialBand;
                const bucket = renderBuckets[bucketIndex];
                if (bucket.length === 0) continue;
                const materialProgress = materialBand / (MATERIAL_BANDS - 1);
                context.beginPath();
                const depthRatio = depthBand / Math.max(1, DEPTH_BANDS - 1);
                const depthLight = 0.48 + depthRatio * 0.52;
                context.fillStyle = mixColour(
                  SCENE_PALETTES[fromScene][fromGroup],
                  SCENE_PALETTES[toScene][toGroup],
                  materialProgress,
                  alphas[emphasis] * depthLight,
                );

                for (const index of bucket) {
                  const size = sizes[emphasis] * projectedScale[index];
                  context.moveTo(projectedX[index] + size, projectedY[index]);
                  context.arc(projectedX[index], projectedY[index], size, 0, Math.PI * 2);
                }
                context.fill();
                if (emphasis > 0) {
                  const settledGlow =
                    1 - Math.sin(materialProgress * Math.PI) * 0.16;
                  context.globalCompositeOperation = "lighter";
                  context.fillStyle = mixColour(
                    SCENE_PALETTES[fromScene][fromGroup],
                    SCENE_PALETTES[toScene][toGroup],
                    materialProgress,
                    (emphasis === 2 ? 0.18 : 0.07) * depthLight * settledGlow,
                  );
                  context.fill();
                  context.globalCompositeOperation = "source-over";
                }
              }
            }
          }
        }
      }
      context.restore();

      if (!reducedMotion && quality.tier !== "constrained") {
        const frameBudget = quality.minimumFrameInterval || 1000 / 60;
        const paintDuration = performance.now() - paintStartedAt;
        slowFrameScore = paintDuration > frameBudget * 0.82
          ? slowFrameScore + 1
          : Math.max(0, slowFrameScore - 2);
        if (slowFrameScore >= 24) {
          forceConstrainedQuality = true;
          slowFrameScore = 0;
          window.requestAnimationFrame(resize);
        }
      }

      if (!reducedMotion && documentVisible) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    redrawRef.current = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(draw);
    };

    const handleVisibility = () => {
      documentVisible = !document.hidden;
      if (documentVisible && !reducedMotion) {
        lastFrameAt = 0;
        lastPaintAt = 0;
        lastScrollAt = performance.now();
        lastScrollY = window.scrollY;
        targetScrollVelocity = 0;
        renderedScrollVelocity = 0;
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    const handleReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      readScrollProgress();
      lastPaintAt = 0;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    readScrollProgress();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    canvas.closest("main")?.querySelectorAll<HTMLElement>("[data-landing-copy]")
      .forEach((copy) => resizeObserver.observe(copy));
    window.addEventListener("scroll", readScrollProgress, { passive: true });
    window.addEventListener("pointermove", readPointer, { passive: true });
    window.addEventListener("blur", clearPointer);
    document.documentElement.addEventListener("pointerleave", clearPointer);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotionQuery.addEventListener("change", handleReducedMotion);
    loadParticleAtlas()
      .then((loadedAtlas) => {
        if (disposed) return;
        atlas = loadedAtlas;
        scenes = buildParticleScenes(atlas, particleCount);
        sceneBounds = scenes.targets.map(measureParticleBounds);
        const shouldPlayIntro = !reducedMotion && window.scrollY < 8;
        const introDuration = width < 640 ? 900 : 1800;
        const mobilePreRoll = width < 640 ? 420 : 0;
        introStartedAt = performance.now() - (shouldPlayIntro ? mobilePreRoll : introDuration);
        if (!shouldPlayIntro) renderedProgress = targetProgress;
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(draw);
      })
      .catch((error: unknown) => {
        console.error("Unable to load the Karrot particle atlas.", error);
      });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener("scroll", readScrollProgress);
      window.removeEventListener("pointermove", readPointer);
      window.removeEventListener("blur", clearPointer);
      document.documentElement.removeEventListener("pointerleave", clearPointer);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotionQuery.removeEventListener("change", handleReducedMotion);
      window.cancelAnimationFrame(animationFrame);
      redrawRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}
