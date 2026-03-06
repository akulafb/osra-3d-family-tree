import { useRef } from 'react';
import { useScroll, motion, useTransform, useReducedMotion } from 'motion/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { HangarTransition } from './HangarTransition';
import { MeetOsraHero } from './MeetOsraHero';
import { HowItWorks } from './HowItWorks';
import { MetricsSection } from './MetricsSection';
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

      {/* Breathing space — metrics mid-way between hero and HowItWorks */}
      <div className={styles.sectionSpacerSmall} />
      <MetricsSection />
      <div className={styles.sectionSpacerSmall} />

      {/* How It Works */}
      <HowItWorks />

      <div className={styles.sectionSpacerSmall} />

      {/* CTA */}
      <section className={styles.hangarLayer}>
        <HangarTransition onSignIn={onSignIn} />
      </section>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          position: 'relative',
          padding: '60px 20px',
          textAlign: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'var(--landing-bg)',
          zIndex: 40,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: '#fff',
            fontSize: '0.9rem',
            opacity: 0.8,
            fontFamily: '"Lora", Georgia, serif',
          }}
        >
          Osra 3D Family Tree © {new Date().getFullYear()} — Invite Only
        </Typography>
        <Typography
          sx={{
            marginTop: '16px',
            fontFamily: 'inherit',
            fontSize: '1.4rem',
            color: '#a5b4ff',
            fontStyle: 'normal',
            textShadow: '0 0 15px rgba(165, 180, 255, 0.4)',
          }}
        >
          Created by FB
        </Typography>
      </Box>
    </div>
  );
}

export default LandingPage;
