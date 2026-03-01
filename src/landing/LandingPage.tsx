import { useRef } from 'react';
import { useScroll, motion, useTransform, useReducedMotion } from 'motion/react';
import { HangarTransition } from './HangarTransition';
import { MeetOsraHero } from './MeetOsraHero';
import { HowItWorks } from './HowItWorks';
import { landingHeroCopy } from './content';
import styles from './LandingPage.module.css';
import './landingTokens.css';

interface LandingPageProps {
  onSignIn: () => void;
}

export function LandingPage({ onSignIn }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroTrackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const HERO_SEQUENCE_END = 0.96;

  // Track scroll progress for the entire page (for progress bar)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Hero owns its own scroll track for animation timing
  const { scrollYProgress: heroScrollY } = useScroll({
    target: heroTrackRef,
    offset: ['start start', 'end end'],
  });

  // Animation is now relative to the heroTrack only
  const heroProgress = useTransform(heroScrollY, [0, HERO_SEQUENCE_END], [0, 1]);
  const pageProgressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div ref={containerRef} className={`osraLanding ${styles.pageRoot}`}>
      <div className={styles.progressTrack} aria-hidden="true">
        <motion.div className={styles.progressFill} style={{ width: pageProgressWidth }} />
      </div>

      {/* Hero Section Scroll Track */}
      <div ref={heroTrackRef} className={styles.heroTrack}>
        <section className={styles.heroLayer}>
          <MeetOsraHero onSignIn={onSignIn} scrollYProgress={heroProgress} />

          {/* Scroll hint */}
          <div className={styles.scrollHint}>
            <motion.div
              animate={reducedMotion ? undefined : { y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className={styles.scrollMouse}
            >
              <motion.div
                animate={reducedMotion ? undefined : { opacity: [1, 0.3, 1], y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className={styles.scrollDot}
              />
            </motion.div>
          </div>
        </section>
      </div>

      {/* Static Sections follow the heroTrack in normal document flow */}
      <div className={styles.sectionSpacer} />

      {/* Static "How It Works" Section */}
      <HowItWorks />

      <div className={styles.sectionSpacer} />

      {/* Hangar/CTA Section - appears at the end */}
      <section className={styles.hangarLayerStatic}>
        <HangarTransition onSignIn={onSignIn} />
      </section>

      {/* Footer - at the very bottom of scroll */}
      <footer className={styles.footer}>
        <p className={styles.footerMain}>
          Osra 3D Family Tree © {new Date().getFullYear()} — Invite Only
        </p>
        <p className={styles.footerSignature}>
          Created by FB
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
