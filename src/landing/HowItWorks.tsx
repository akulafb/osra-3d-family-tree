import { motion } from 'motion/react';

const STEPS = [
  {
    number: '01',
    title: 'Receive an Invite',
    description:
      'Only direct family members (1-degree connection) can invite you. Receive a secure, time-limited invitation link via email or message.',
    icon: '📧',
  },
  {
    number: '02',
    title: 'Claim Your Place',
    description:
      'Click the link and sign in with Google. No passwords to remember, just seamless authentication that connects you to your family.',
    icon: '🔐',
  },
  {
    number: '03',
    title: 'Find Your Branch',
    description:
      'Automatically connected to your position in the family tree. See your immediate family visualized in stunning 3D space.',
    icon: '🌳',
  },
  {
    number: '04',
    title: 'Expand the Tree',
    description:
      'Add your parents, children, siblings, or spouse. Invite them to join and claim their nodes. Watch the family tree grow organically.',
    icon: '✨',
  },
];

const FEATURES = [
  {
    title: 'Invite-Only Access',
    description: 'No public profiles. Your family tree is completely private and accessible only to invited members.',
  },
  {
    title: '1-Degree Editing',
    description: 'Edit only your direct connections: parents, children, siblings, and spouse. Maintain accuracy through distributed trust.',
  },
  {
    title: 'Your Data, Your Control',
    description: 'Full ownership of your information. Export or delete your data at any time.',
  },
];

export function HowItWorks() {
  return (
    <section
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0a0a0a 0%, #0f0f1a 100%)',
        padding: '100px 20px',
        position: 'relative',
      }}
    >
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true, margin: '-100px' }}
        style={{
          textAlign: 'center',
          maxWidth: '700px',
          margin: '0 auto 80px auto',
        }}
      >
        <div
          style={{
            fontSize: '0.9rem',
            color: '#667eea',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}
        >
          How It Works
        </div>
        <h2
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '1rem',
          }}
        >
          Four Simple Steps
        </h2>
        <p
          style={{
            fontSize: '1.1rem',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
          }}
        >
          From invitation to exploration — discover how easy it is to join
          and grow your family tree.
        </p>
      </motion.div>

      {/* Steps Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '30px',
          maxWidth: '1200px',
          margin: '0 auto 100px auto',
          padding: '0 20px',
        }}
      >
        {STEPS.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            viewport={{ once: true, margin: '-50px' }}
            whileHover={{ y: -5 }}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '40px 30px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Gradient border effect */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #667eea, transparent)',
                opacity: 0.5,
              }}
            />

            {/* Step number */}
            <div
              style={{
                fontSize: '3rem',
                fontWeight: 800,
                color: 'rgba(102,126,234,0.2)',
                position: 'absolute',
                top: '20px',
                right: '20px',
                lineHeight: 1,
              }}
            >
              {step.number}
            </div>

            {/* Icon */}
            <div
              style={{
                fontSize: '2.5rem',
                marginBottom: '20px',
              }}
            >
              {step.icon}
            </div>

            {/* Content */}
            <h3
              style={{
                fontSize: '1.3rem',
                fontWeight: 600,
                color: '#fff',
                marginBottom: '12px',
              }}
            >
              {step.title}
            </h3>
            <p
              style={{
                fontSize: '0.95rem',
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.6,
              }}
            >
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Features Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true, margin: '-100px' }}
        style={{
          maxWidth: '900px',
          margin: '0 auto 80px auto',
          padding: '60px 40px',
          background: 'rgba(102,126,234,0.05)',
          borderRadius: '24px',
          border: '1px solid rgba(102,126,234,0.1)',
        }}
      >
        <h3
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#fff',
            textAlign: 'center',
            marginBottom: '40px',
          }}
        >
          Privacy & Security First
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '30px',
          }}
        >
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <h4
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#667eea',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>✓</span>
                {feature.title}
              </h4>
              <p
                style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.5,
                }}
              >
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

    </section>
  );
}
