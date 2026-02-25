import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';

interface HangarTransitionProps {
  onSignIn: () => void;
}

export function HangarTransition({ onSignIn }: HangarTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSignInClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSignIn();
  };

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // CTA reveals as user scrolls past the sequence
  const ctaOpacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.3, 0.5], [30, 0]);

  // Hangar door effect - closing as we enter
  const doorLeftX = useTransform(scrollYProgress, [0, 0.4], ['-100%', '0%']);
  const doorRightX = useTransform(scrollYProgress, [0, 0.4], ['100%', '0%']);
  const doorOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);

  return (
    <section
      ref={containerRef}
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
      {/* Hangar door effect - sliding panels */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '50%',
          height: '100%',
          background: 'linear-gradient(90deg, #0a0a0a 0%, #111 100%)',
          x: doorLeftX,
          opacity: doorOpacity,
          zIndex: 5,
        }}
      />

      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50%',
          height: '100%',
          background: 'linear-gradient(270deg, #0a0a0a 0%, #111 100%)',
          x: doorRightX,
          opacity: doorOpacity,
          zIndex: 5,
        }}
      />

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

      <motion.div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          maxWidth: '600px',
          opacity: ctaOpacity,
          y: ctaY,
        }}
      >
        {/* Arrival message */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          style={{
            fontSize: '1rem',
            color: '#8b9fff', // Brightened from #667eea
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
            textShadow: '0 0 15px rgba(139, 159, 255, 0.5)',
          }}
        >
          ✦ You Have Arrived ✦
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 1rem 0',
            textShadow: '0 0 30px rgba(255, 255, 255, 0.5)',
          }}
        >
          Ready to Explore Your Family Tree?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          style={{
            fontSize: '1.1rem',
            color: '#ffffff', // Brightened from rgba(255,255,255,0.7)
            marginBottom: '2.5rem',
            lineHeight: 1.6,
            textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
          }}
        >
          Join your family in a new dimension. Sign in with Google to access
          your invite-only family tree.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
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

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          viewport={{ once: true }}
          style={{
            marginTop: '1.5rem',
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.6)', // Brightened from 0.4
          }}
        >
          Invite-only. Secure. Private.
        </motion.p>
      </motion.div>
    </section>
  );
}
