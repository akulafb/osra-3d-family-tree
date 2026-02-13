import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';

interface HangarTransitionProps {
  onSignIn: () => void;
}

export function HangarTransition({ onSignIn }: HangarTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // CTA reveals as user scrolls past the sequence
  const ctaOpacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.3, 0.5], [50, 0]);

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
            color: '#667eea',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
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
            color: '#fff',
            margin: '0 0 1rem 0',
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
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '2.5rem',
            lineHeight: 1.6,
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
          onClick={onSignIn}
          style={{
            padding: '18px 48px',
            fontSize: '1.2rem',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '50px',
            cursor: 'pointer',
            boxShadow: '0 8px 30px rgba(102, 126, 234, 0.4)',
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
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Invite-only. Secure. Private.
        </motion.p>
      </motion.div>
    </section>
  );
}
