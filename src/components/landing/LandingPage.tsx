import { useState, useCallback } from 'react';
import { HeroSection } from './HeroSection';
import { SequenceViewer } from './SequenceViewer';
import { ScrollOverlays, JourneyProgress } from './ScrollOverlays';
import { HangarTransition } from './HangarTransition';
import { MetricsSection } from './MetricsSection';
import { HowItWorks } from './HowItWorks';

interface LandingPageProps {
  onSignIn: () => void;
}

export function LandingPage({ onSignIn }: LandingPageProps) {
  const [currentFrame, setCurrentFrame] = useState(0);

  const handleFrameChange = useCallback((frameIndex: number) => {
    setCurrentFrame(frameIndex);
  }, []);

  return (
    <div
      style={{
        background: '#0a0a0a',
        color: '#fff',
      }}
    >
      {/* Hero Section - Above the fold */}
      <HeroSection onSignIn={onSignIn} />

      {/* Sequence Section - Scroll-driven 3D experience */}
      {/* This section takes over the viewport on scroll */}
      <section style={{ position: 'relative' }}>
        <SequenceViewer
          frameCount={100}
          baseUrl="/frames"
          onFrameChange={handleFrameChange}
        />
        
        {/* Overlays positioned over the sticky sequence */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '400vh', // Match SequenceViewer height
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              height: '100vh',
            }}
          >
            <ScrollOverlays currentFrame={currentFrame} frameCount={100} />
            <JourneyProgress currentFrame={currentFrame} frameCount={100} />
          </div>
        </div>
      </section>

      {/* Metrics Section - shows family stats */}
      <MetricsSection />

      {/* Hangar Transition / CTA - appears after sequence completes */}
      <HangarTransition onSignIn={onSignIn} />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Footer */}
      <footer
        style={{
          padding: '60px 20px 40px 20px',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: '#0a0a0a',
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
          3D Family Tree © {new Date().getFullYear()} — Invite Only
        </p>
        <p
          style={{
            marginTop: '20px',
            fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
            fontSize: '1.5rem',
            color: 'rgba(102,126,234,0.6)',
            fontStyle: 'italic',
          }}
        >
          Created by FB
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
