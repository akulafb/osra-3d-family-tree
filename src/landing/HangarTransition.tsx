import { motion } from 'motion/react';

interface HangarTransitionProps {
  onSignIn: () => void;
}

export function HangarTransition({ onSignIn }: HangarTransitionProps) {
  const handleSignInClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSignIn();
  };

  return (
    <section
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(102,126,234,0.1) 0%, transparent 60%)',
          filter: 'blur(80px)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          maxWidth: '600px',
        }}
      >
        {/* Arrival message */}
        <div
          style={{
            fontSize: '1rem',
            color: '#8b9fff',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
            textShadow: '0 0 15px rgba(139, 159, 255, 0.5)',
          }}
        >
          ✦ You Have Arrived ✦
        </div>

        <h2
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 1rem 0',
            textShadow: '0 0 30px rgba(255, 255, 255, 0.5)',
          }}
        >
          Ready to Explore Your Family Tree?
        </h2>

        <p
          style={{
            fontSize: '1.1rem',
            color: '#ffffff',
            marginBottom: '2.5rem',
            lineHeight: 1.6,
            textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
          }}
        >
          Join your family in a new dimension. Sign in with Google to access
          your invite-only family tree.
        </p>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSignInClick}
          style={{
            padding: '18px 48px',
            fontSize: '1.2rem',
            fontWeight: 600,
            background: '#ffffff',
            color: '#1a1a2e',
            border: 'none',
            borderRadius: '50px',
            cursor: 'pointer',
            boxShadow: '0 8px 30px rgba(102, 126, 234, 0.5)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          Sign in with Google
        </motion.button>

        <p
          style={{
            marginTop: '1.5rem',
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          Invite-only. Secure. Private.
        </p>
      </div>
    </section>
  );
}
