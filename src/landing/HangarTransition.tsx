import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

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
    <Box
      component="section"
      sx={{
        minHeight: '100vh',
        background: '#07030f',
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
      <Box
        sx={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(102,126,234,0.1) 0%, transparent 60%)',
          filter: 'blur(80px)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          maxWidth: 600,
        }}
      >
        {/* Arrival message */}
        <Typography
          sx={{
            fontSize: '1rem',
            color: '#8b9fff',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
            textShadow: '0 0 15px rgba(139, 159, 255, 0.5)',
            fontFamily: '"Lora", Georgia, serif',
          }}
        >
          ✦ You Have Arrived ✦
        </Typography>

        <Typography
          component="h2"
          sx={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 1rem 0',
            textShadow: '0 0 30px rgba(255, 255, 255, 0.5)',
            fontFamily: '"Lora", Georgia, serif',
          }}
        >
          Ready to Explore Your Family Tree?
        </Typography>

        <Typography
          sx={{
            fontSize: '1.1rem',
            color: '#ffffff',
            marginBottom: '2.5rem',
            lineHeight: 1.6,
            textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
            fontFamily: '"Lora", Georgia, serif',
          }}
        >
          Join your family in a new dimension. Sign in with Google to access
          your invite-only family tree.
        </Typography>

        <Button
          onClick={handleSignInClick}
          sx={{
            padding: '18px 48px',
            fontSize: '1.2rem',
            fontWeight: 600,
            background: '#ffffff',
            color: '#1a1a2e',
            borderRadius: '50px',
            boxShadow: '0 8px 30px rgba(102, 126, 234, 0.5)',
            fontFamily: '"Lora", Georgia, serif',
            '&:hover': {
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 8px 30px rgba(102, 126, 234, 0.6)',
            },
          }}
        >
          Sign in with Google
        </Button>

        <Typography
          sx={{
            marginTop: '1.5rem',
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: '"Lora", Georgia, serif',
          }}
        >
          Invite-only. Secure. Private.
        </Typography>
      </Box>
    </Box>
  );
}
