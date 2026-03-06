import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

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
    <Box
      component="section"
      sx={{
        background: '#07030f',
        padding: { xs: '80px 6vw 100px', md: '120px 6vw 140px' },
        position: 'relative',
        zIndex: 20,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: { xs: '80px 0', md: '80px 48px' },
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {STEPS.map((step) => (
          <Box key={step.number} sx={{ position: 'relative', paddingTop: '32px' }}>
            {/* Rule */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'rgba(124,58,237,0.25)',
              }}
            />

            {/* Number + Content side-by-side */}
            <Box sx={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <Typography
                component="div"
                sx={{
                  fontSize: 64,
                  fontFamily: '"Lora", Georgia, serif',
                  fontWeight: 700,
                  color: '#2d1b69',
                  opacity: 0.55,
                  lineHeight: 1,
                  userSelect: 'none',
                  marginTop: '-4px',
                  flexShrink: 0,
                }}
              >
                {step.number}
              </Typography>

              <Box sx={{ flex: 1 }}>
                <Typography
                  component="h3"
                  variant="h6"
                  sx={{
                    fontSize: 22,
                    fontFamily: '"Lora", Georgia, serif',
                    fontWeight: 700,
                    color: '#ede9fe',
                    marginBottom: '12px',
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '15.5px',
                    fontFamily: '"Lora", Georgia, serif',
                    fontWeight: 400,
                    color: '#7c5cbf',
                    lineHeight: 1.7,
                  }}
                >
                  {step.description}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
