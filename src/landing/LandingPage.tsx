import { useRef } from 'react';
import { useScroll, motion, useTransform, useReducedMotion } from 'motion/react';
import { HangarTransition } from './HangarTransition';
import { MeetOsraHero } from './MeetOsraHero';
import { HowItWorks } from './HowItWorks';
import styles from './LandingPage.module.css';
import './landingTokens.css';

interface LandingPageProps {
  onSignIn: () => void;
}

export function LandingPage({ onSignIn }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroTrackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Full-page progress for the top progress bar
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Hero animation scoped to heroTrack only
  const { scrollYProgress: heroScrollY } = useScroll({
    target: heroTrackRef,
    offset: ['start start', 'end end'],
  });

  const pageProgressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div ref={containerRef} className={`osraLanding ${styles.pageRoot}`}>
      {/* Top progress bar */}
      <div className={styles.progressTrack} aria-hidden="true">
        <motion.div className={styles.progressFill} style={{ width: pageProgressWidth }} />
      </div>

      {/* Hero scroll track — 1000vh of scrollable distance */}
      <div ref={heroTrackRef} className={styles.heroTrack}>
        <section className={styles.heroLayer}>
          <MeetOsraHero onSignIn={onSignIn} scrollYProgress={heroScrollY} />

          {/* Scroll hint mouse widget */}
          <div
            style={{
              position: 'absolute',
              bottom: 34,
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              animate={reducedMotion ? undefined : { y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 24, height: 40,
                border: '2px solid rgba(255,255,255,0.22)',
                borderRadius: 12,
                display: 'flex', justifyContent: 'center',
                paddingTop: 8,
              }}
            >
              <motion.div
                animate={reducedMotion ? undefined : { opacity: [1, 0.3, 1], y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 4, height: 8, background: '#7b61ff', borderRadius: 2 }}
              />
            </motion.div>
          </div>
        </section>
      </div>

      {/* Breathing space */}
      <div className={styles.sectionSpacer} />

      {/* How It Works */}
      <HowItWorks />

      <div className={styles.sectionSpacer} />

      {/* CTA */}
      <section className={styles.hangarLayer}>
        <HangarTransition onSignIn={onSignIn} />
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerMain}>
          Osra 3D Family Tree © {new Date().getFullYear()} — Invite Only
        </p>
        <p className={styles.footerSignature}>Created by FB</p>
      </footer>
    </div>
  );
}

export default LandingPage;
