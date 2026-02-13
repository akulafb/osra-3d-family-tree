import { motion, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { usePublicMetrics } from '../hooks/usePublicMetrics';

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
}

function AnimatedNumber({ value, suffix = '' }: AnimatedNumberProps) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Create a motion value that springs to the target
  const springValue = useSpring(0, {
    damping: 30,
    stiffness: 100,
  });

  // Transform the spring value to an integer
  const displayValue = useTransform(springValue, (latest) => Math.floor(latest));

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInView) {
          setIsInView(true);
          springValue.set(value);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [value, springValue, isInView]);

  return (
    <span ref={ref}>
      <motion.span>{displayValue}</motion.span>
      {suffix}
    </span>
  );
}

export function MetricsSection() {
  const { individuals, families, isLoading, hasError } = usePublicMetrics();

  // Hide component if fetch failed
  if (hasError) {
    return null;
  }

  return (
    <section
      style={{
        padding: '80px 20px',
        background: '#0a0a0a',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'clamp(60px, 15vw, 200px)',
          flexWrap: 'wrap',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(4rem, 10vw, 7rem)',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1,
              opacity: isLoading ? 0.5 : 1,
              transition: 'opacity 0.3s',
            }}
          >
            <AnimatedNumber value={individuals} />
          </div>
          <div
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.3rem)',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginTop: '10px',
            }}
          >
            Individuals
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(4rem, 10vw, 7rem)',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1,
              opacity: isLoading ? 0.5 : 1,
              transition: 'opacity 0.3s',
            }}
          >
            <AnimatedNumber value={families} />
          </div>
          <div
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.3rem)',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginTop: '10px',
            }}
          >
            Families
          </div>
        </motion.div>
      </div>
    </section>
  );
}
