import { useRef, useState } from 'react';
import { useScroll, motion, useTransform, useMotionValueEvent } from 'motion/react';
import { StarfieldBackground } from './StarfieldBackground';
import { ScrollOverlays, JourneyProgress } from './ScrollOverlays';
import { HangarTransition } from './HangarTransition';

interface LandingPageProps {
  onSignIn: () => void;
}

export function LandingPage({ onSignIn }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [heroHidden, setHeroHidden] = useState(false);

  // Track scroll progress for the entire page
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Hero fades out 0-3%, completely gone by 3%
  const heroOpacity = useTransform(scrollYProgress, [0, 0.03], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.03], [0, -20]);
  
  // Hide hero completely when opacity reaches 0
  useMotionValueEvent(heroOpacity, 'change', (latest) => {
    setHeroHidden(latest < 0.01);
  });

  // Scroll overlays fade in after hero, then fade out before hangar
  const overlaysOpacity = useTransform(scrollYProgress, [0.03, 0.08, 0.88, 0.92], [0, 1, 1, 0]);

  // Starfield is visible throughout
  const starfieldOpacity = useTransform(scrollYProgress, [0, 0.05], [0, 1]);

  // Hangar section appears after step 4 is fully visible
  const hangarOpacity = useTransform(scrollYProgress, [0.90, 0.97], [0, 1]);
  const hangarPointerEvents = useTransform(hangarOpacity, (v) => (v > 0.01 ? 'auto' : 'none'));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        background: '#0a0a0a',
        color: '#fff',
        height: '500vh',
      }}
    >
      {/* Fixed Starfield Background - spans entire page */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
        }}
      >
        <motion.div style={{ opacity: starfieldOpacity, width: '100%', height: '100%' }}>
          <StarfieldBackground scrollYProgress={scrollYProgress} />
        </motion.div>
      </div>

      {/* Hero Section - fades out quickly and hides */}
      {!heroHidden && (
        <motion.section
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: heroOpacity,
            y: heroY,
          }}
        >
          {/* Gradient overlay for depth */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
              zIndex: -1,
              pointerEvents: 'none',
            }}
          />

          {/* Subtle starfield preview in hero */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.3), transparent),
                radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.2), transparent),
                radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.3), transparent),
                radial-gradient(2px 2px at 160px 120px, rgba(255,255,255,0.2), transparent)
              `,
              backgroundRepeat: 'repeat',
              backgroundSize: '350px 200px',
              opacity: 0.4,
              zIndex: -1,
              pointerEvents: 'none',
            }}
          />

          {/* Content */}
          <div style={{ textAlign: 'center', padding: '0 20px', maxWidth: '700px', position: 'relative', zIndex: 10 }}>
            {/* Logo/Mark */}
            <div style={{ marginBottom: '2rem' }}>
              <span
                style={{
                  fontSize: '2.5rem',
                  color: '#667eea',
                  fontFamily: "'Brush Script MT', 'Segoe Script', 'Dancing Script', cursive",
                  fontStyle: 'italic',
                  marginRight: '12px',
                }}
              >
                Osra
              </span>
              <span
                style={{
                  fontSize: '0.9rem',
                  color: '#667eea',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                }}
              >
                3D Family Tree
              </span>
            </div>

            {/* Main heading */}
            <h1
              style={{
                fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                fontWeight: 700,
                color: '#fff',
                margin: '0 0 1.5rem 0',
                lineHeight: 1.1,
              }}
            >
              Discover Your
              <br />
              <span style={{ color: '#667eea' }}>Roots</span> in 3D
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                color: 'rgba(255,255,255,0.7)',
                margin: '0 auto 3rem auto',
                lineHeight: 1.6,
                maxWidth: '550px',
              }}
            >
              Explore how your family is connected in a stunning 3D space.
              Individuals as planets, families as systems.
            </p>

            {/* CTA Button */}
            <button
              onClick={onSignIn}
              style={{
                padding: '16px 40px',
                fontSize: '1.1rem',
                fontWeight: 600,
                background: '#fff',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
              }}
            >
              Sign in with Google
            </button>
          </div>

          {/* Scroll hint */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.8rem',
              letterSpacing: '0.1em',
            }}
          >
            <span>Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: '24px',
                height: '40px',
                border: '2px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'center',
                paddingTop: '8px',
              }}
            >
              <motion.div
                animate={{ opacity: [1, 0.3, 1], y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: '4px',
                  height: '8px',
                  background: '#667eea',
                  borderRadius: '2px',
                }}
              />
            </motion.div>
          </div>
        </motion.section>
      )}

      {/* Scroll-driven overlays (How It Works cards) - fade in after hero is gone */}
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 20,
          pointerEvents: 'none',
          opacity: overlaysOpacity,
        }}
      >
        <ScrollOverlays scrollProgress={scrollYProgress} />
        <JourneyProgress scrollProgress={scrollYProgress} />
      </motion.div>

      {/* Hangar/CTA Section - appears at the end */}
      <motion.section
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hangarOpacity,
          pointerEvents: hangarPointerEvents,
          background: '#0a0a0a',
        }}
      >
        <HangarTransition onSignIn={onSignIn} />
      </motion.section>

      {/* Footer - at the very bottom of scroll */}
      <footer
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '60px 20px', // Increased padding
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: '#0a0a0a',
          zIndex: 40,
        }}
      >
        <p style={{ color: '#ffffff', fontSize: '0.9rem', opacity: 0.8 }}>
          Osra 3D Family Tree © {new Date().getFullYear()} — Invite Only
        </p>
        <p
          style={{
            marginTop: '16px',
            fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
            fontSize: '1.4rem',
            color: '#a5b4ff',
            fontStyle: 'italic',
            textShadow: '0 0 15px rgba(165, 180, 255, 0.4)',
          }}
        >
          Created by FB
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
