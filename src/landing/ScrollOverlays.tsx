import { motion, useTransform, type MotionValue } from 'motion/react';

interface ScrollOverlaysProps {
  scrollProgress: MotionValue<number>;
}

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Receive an Invite',
    description: 'Only direct family members can invite you. Receive a secure link via email.',
  },
  {
    number: '02',
    title: 'Claim Your Place',
    description: 'Click the link and sign in with Google. No passwords needed.',
  },
  {
    number: '03',
    title: 'Find Your Branch',
    description: 'Automatically connected to your position in the family tree.',
  },
  {
    number: '04',
    title: 'Expand the Tree',
    description: 'Add parents, children, siblings, or spouse. Invite them to join.',
  },
];

// How It Works overlays - displayed as glowing violet cards during scroll
export function ScrollOverlays({ scrollProgress }: ScrollOverlaysProps) {
  // Step 1: 15% - 30% (15% duration)
  const step1Opacity = useTransform(scrollProgress, [0.15, 0.18, 0.27, 0.3], [0, 1, 1, 0]);
  // Step 2: 35% - 50% (15% duration)
  const step2Opacity = useTransform(scrollProgress, [0.35, 0.38, 0.47, 0.5], [0, 1, 1, 0]);
  // Step 3: 55% - 70% (15% duration)
  const step3Opacity = useTransform(scrollProgress, [0.55, 0.58, 0.67, 0.7], [0, 1, 1, 0]);
  // Step 4: 75% - 90% (15% duration)
  const step4Opacity = useTransform(scrollProgress, [0.75, 0.78, 0.87, 0.9], [0, 1, 1, 0]);

  const stepOpacities = [step1Opacity, step2Opacity, step3Opacity, step4Opacity];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {HOW_IT_WORKS_STEPS.map((step, index) => (
        <motion.div
          key={step.number}
          style={{
            position: 'absolute',
            opacity: stepOpacities[index],
            maxWidth: '480px',
            padding: '40px 48px',
            background: 'rgba(102, 126, 234, 0.25)', // Brighter background
            border: '1px solid rgba(165, 180, 255, 0.6)', // Brighter border
            borderRadius: '20px',
            boxShadow: '0 0 100px rgba(165, 180, 255, 0.4), inset 0 0 60px rgba(165, 180, 255, 0.2)',
            textAlign: 'center',
            backdropFilter: 'blur(12px)', // Slightly more blur for contrast
          }}
        >
          {/* Step number - very bright */}
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#ffffff', // Pure white
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: '16px',
              textShadow: '0 0 15px rgba(255, 255, 255, 0.8)',
            }}
          >
            Step {step.number}
          </div>

          {/* Title - very bright */}
          <h3
            style={{
              fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)',
              fontWeight: 800,
              color: '#ffffff',
              margin: '0 0 16px 0',
              textShadow: '0 0 30px rgba(255, 255, 255, 0.9), 0 0 60px rgba(165, 180, 255, 0.7)',
            }}
          >
            {step.title}
          </h3>

          {/* Description - very bright */}
          <p
            style={{
              fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
              color: '#ffffff',
              lineHeight: 1.6,
              margin: 0,
              textShadow: '0 0 15px rgba(255, 255, 255, 0.6)',
            }}
          >
            {step.description}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// Progress indicator - no labels
export function JourneyProgress({ scrollProgress }: ScrollOverlaysProps) {
  const progressWidth = useTransform(scrollProgress, [0, 1], ['0%', '100%']);

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
          height: '3px',
          background: 'rgba(255,255,255,0.3)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, #a5b4ff, #ffffff)', // Fades to white for brightness
            width: progressWidth,
            boxShadow: '0 0 15px rgba(165, 180, 255, 1)',
          }}
        />
      </div>
    </div>
  );
}
