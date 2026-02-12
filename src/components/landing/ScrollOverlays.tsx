import { motion } from 'motion/react';

interface ScrollOverlaysProps {
  currentFrame: number;
  frameCount?: number;
}

// Family name overlays removed - timing didn't work well with scroll
// Component kept for future overlay needs
export function ScrollOverlays({}: ScrollOverlaysProps) {
  return null;
}

// Progress indicator showing journey progress
export function JourneyProgress({ currentFrame, frameCount = 100 }: ScrollOverlaysProps) {
  const progress = ((currentFrame + 1) / frameCount) * 100;
  
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '200px',
        zIndex: 10,
      }}
    >
      <div
        style={{
          height: '2px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '1px',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, #667eea, #764ba2)',
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        <span>Start</span>
        <span>Hangar</span>
      </div>
    </div>
  );
}
