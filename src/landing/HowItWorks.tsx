import { motion } from 'motion/react';

const STEPS = [
  {
    number: '01',
    title: 'Receive an Invite',
    description: 'Only direct family members can invite you (by clicking on their name) by sharing a secure link.',
  },
  {
    number: '02',
    title: 'Claim Your Place',
    description: "Click the link and sign in with your Google account. You're in!",
  },
  {
    number: '03',
    title: 'Explore, find your name, and expand the tree!',
    description: 'Your node now belongs to you. Invite your parents, children, siblings, or spouse.',
  },
];

export function HowItWorks() {
  return (
    <section
      style={{
        background: '#07030f',
        padding: '120px 6vw 140px',
        position: 'relative',
        zIndex: 20,
      }}
    >
      {/* Steps Grid - Updated for 3 columns on desktop */}
      <div
        className="how-it-works-grid"
        style={{
          display: 'grid',
          gap: '80px 48px',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <style>
          {`
            .how-it-works-grid {
              grid-template-columns: repeat(3, 1fr);
            }
            @media (max-width: 1024px) {
              .how-it-works-grid {
                grid-template-columns: 1fr;
              }
            }
          `}
        </style>
        {STEPS.map((step) => (
          <div
            key={step.number}
            style={{
              position: 'relative',
              paddingTop: '32px',
            }}
          >
            {/* Thin horizontal rule */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'rgba(124,58,237,0.25)',
              }}
            />

            {/* Layout: Number and Content side-by-side */}
            <div
              style={{
                display: 'flex',
                gap: '20px',
                alignItems: 'flex-start',
                position: 'relative',
              }}
            >
              {/* Ghost number - side-by-side to the left */}
              <div
                style={{
                  fontSize: '64px',
                  fontFamily: 'Lora, Georgia, serif',
                  fontWeight: 700,
                  color: '#2d1b69',
                  opacity: 0.55,
                  lineHeight: 1,
                  userSelect: 'none',
                  marginTop: '-4px', // Tweak for visual alignment with title
                }}
              >
                {step.number}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontSize: '22px',
                    fontFamily: 'Lora, Georgia, serif',
                    fontWeight: 700,
                    color: '#ede9fe',
                    marginBottom: '12px',
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: '15.5px',
                    fontFamily: 'Lora, Georgia, serif',
                    fontWeight: 400,
                    color: '#7c5cbf',
                    lineHeight: 1.7,
                  }}
                >
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
