"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { ParticleCanvas } from "@/features/landing/components/particle-canvas";
import { KarrotMark } from "@/shared/components/karrot-mark";
import styles from "./landing-experience.module.css";

const chapters = [
  { id: "awakening", label: "Mission" },
  { id: "australia", label: "Australian market" },
  { id: "human", label: "Human purpose" },
  { id: "karrot", label: "GTM motion" },
  { id: "finale", label: "Commercial system" },
] as const;

export function LandingExperience() {
  const [activeChapter, setActiveChapter] = useState("awakening");

  useEffect(() => {
    const sections = chapters
      .map(({ id }) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;

    // Observer entries can arrive coalesced, stale, or paused while the main
    // thread is busy (mobile flick scrolling) or the tab is throttled, and a
    // wrong chapter would then stick with no further event to correct it.
    // Every trigger therefore re-measures live geometry, and scroll, resize
    // and visibility changes act as additional triggers so the resting state
    // is always recomputed on a visible device.
    let frame = 0;
    const measureActiveChapter = () => {
      frame = 0;
      const viewportHeight = window.innerHeight;
      const bandTop = viewportHeight * 0.32;
      const bandBottom = viewportHeight * 0.68;
      let bestId: string | null = null;
      let bestOverlap = 0;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        const overlap = Math.min(rect.bottom, bandBottom) - Math.max(rect.top, bandTop);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestId = section.id;
        }
      }
      if (bestId) setActiveChapter(bestId);
    };
    const requestSync = () => {
      if (!frame) frame = window.requestAnimationFrame(measureActiveChapter);
    };

    const observer = new IntersectionObserver(requestSync, {
      rootMargin: "-32% 0px -32% 0px",
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });
    sections.forEach((section) => observer.observe(section));
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    document.addEventListener("visibilitychange", requestSync);
    requestSync();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      document.removeEventListener("visibilitychange", requestSync);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const replay = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <main className={styles.experience}>
      <a className={styles.accessibilitySkip} href="#finale">
        Skip animated story
      </a>

      <div className={styles.stage} aria-hidden="true">
        <div className={styles.aurora} />
        <div className={styles.dawn} />
        <ParticleCanvas />
        <div className={styles.vignette} />
        <div className={styles.grain} />
      </div>

      <header className={styles.header}>
        <a className={styles.brand} href="#awakening" aria-label="Karrot experience home">
          <KarrotMark className={styles.brandMark} />
          <span className={styles.brandName}>KARROT</span>
          <span className={styles.brandDescriptor}>Care</span>
        </a>
        <div className={styles.headerActions}>
          <span className={styles.conceptLabel}>Independent Founding GTM proposal</span>
          <a className={styles.skipStory} href="#finale">Skip story</a>
          <Link className={styles.signIn} href="/login">
            Enter GTM Engine
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      <nav className={styles.chapterNav} aria-label="Experience chapters">
        <ol>
          {chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <a
                className={activeChapter === chapter.id ? styles.chapterLinkActive : styles.chapterLink}
                href={`#${chapter.id}`}
                aria-current={activeChapter === chapter.id ? "step" : undefined}
              >
                <span className={styles.chapterNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.chapterLabel}>{chapter.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section
        id="awakening"
        className={`${styles.chapter} ${styles.introChapter} ${activeChapter === "awakening" ? styles.chapterActive : ""}`}
      >
        <div className={styles.copyBlock} data-landing-copy>
          <p className={styles.eyebrow}>An independent proposal · Santiago Gonzalez</p>
          <h1>Aged care, made precise.</h1>
          <p className={styles.lede}>
            That is Karrot&apos;s public mission: turning routine facility data into resident-specific clinical insight, so care teams get time back to care. This is my proposal for the commercial engine that mission deserves.
          </p>
          <a className={styles.scrollCue} href="#australia">
            <span>See the opportunity</span>
            <ArrowDown aria-hidden="true" />
          </a>
        </div>
      </section>

      <section
        id="australia"
        className={`${styles.chapter} ${activeChapter === "australia" ? styles.chapterActive : ""}`}
      >
        <div className={styles.copyBlock} data-landing-copy>
          <p className={styles.eyebrow}>02 · The Australian opportunity</p>
          <h2>
            2,931 homes.
            <br />
            A precise way in.
          </h2>
          <p className={styles.lede}>
            My working GTM Engine starts with 926 NSW homes. It connects evidence, account intelligence, pipeline and next action into a commercial motion Karrot can test, learn and scale.
          </p>

          <p className={styles.disclosure}>Current Provider Register snapshot · Working engine scoped to NSW · No customer or resident data</p>
        </div>
      </section>

      <section
        id="human"
        className={`${styles.chapter} ${activeChapter === "human" ? styles.chapterActive : ""}`}
      >
        <div className={styles.copyBlock} data-landing-copy>
          <p className={styles.eyebrow}>03 · Why it matters</p>
          <h2>Almost every life will touch aged care.</h2>
          <p className={styles.lede}>
            The people at its centre deserve more than averages. The teams beside them deserve more time to care.
          </p>
          <div className={styles.signalLine}>
            <span aria-hidden="true" />
            A cause worth building for.
          </div>
        </div>
      </section>

      <section
        id="karrot"
        className={`${styles.chapter} ${styles.karrotChapter} ${activeChapter === "karrot" ? styles.chapterActive : ""}`}
      >
        <div className={styles.copyBlock} data-landing-copy>
          <p className={styles.eyebrow}>04 · My Founding GTM proposal</p>
          <h2>The mission needs a motion.</h2>
          <p className={styles.lede}>
            I built a working GTM Engine to map the market, preserve every learning, work the pipeline and turn each pilot into a repeatable commercial motion.
          </p>
          <p className={styles.smallAside}>The real reward: precision care reaching more homes.</p>
        </div>
      </section>

      <section
        id="finale"
        className={`${styles.chapter} ${styles.finaleChapter} ${activeChapter === "finale" ? styles.chapterActive : ""}`}
      >
        <div className={`${styles.copyBlock} ${styles.finaleCopy}`} data-landing-copy>
          <div className={styles.finaleBrand} aria-label="Karrot">
            <KarrotMark className={styles.finaleMark} labelled />
            <span>KARROT REVENUE OS</span>
          </div>
          <p className={styles.eyebrow}>The commercial operating system</p>
          <h2>One system. The whole commercial picture.</h2>
          <p className={styles.lede}>
            Working today: the NSW market mapped from the Provider Register, evidence-backed account intelligence with human review, pipeline, tasks and customer continuity in one live view.
          </p>
          <div className={styles.signalLine}>
            <span aria-hidden="true" />
            Evidence first. Human judgement leads.
          </div>
          <p className={styles.smallAside}>
            Next, one milestone at a time: meeting preparation, effortless capture, market monitoring and a commercial learning loop.
          </p>
          <p className={styles.smallAside}>My proposal is to build it, own it and run it for Karrot.</p>
          <div className={styles.finaleActions}>
            <Link className={styles.primaryAction} href="/login">
              Try the working GTM Engine
              <ArrowRight aria-hidden="true" />
            </Link>
            <button className={styles.replayAction} type="button" onClick={replay}>
              <RotateCcw aria-hidden="true" />
              Replay experience
            </button>
          </div>
          <p className={styles.accessNote}>
            Independent prototype by Santiago Gonzalez · Built for Karrot Care&apos;s Founding GTM role · Access is provisioned for invited evaluators
          </p>
        </div>
      </section>
    </main>
  );
}
