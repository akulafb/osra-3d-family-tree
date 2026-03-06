import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { usePublicMetrics } from '../hooks/usePublicMetrics';

export function MetricsSection() {
  const { individuals, families, isLoading, hasError } = usePublicMetrics();

  const displayIndividuals = isLoading || hasError ? '—' : individuals;
  const displayFamilies = isLoading || hasError ? '—' : families;

  return (
    <Box
      component="section"
      aria-live="polite"
      sx={{
        background: '#07030f',
        padding: { xs: '80px 24px', md: '100px 48px' },
        position: 'relative',
        zIndex: 20,
      }}
    >
      <Typography
        component="h2"
        sx={{
          fontFamily: '"Lora", Georgia, serif',
          fontWeight: 700,
          fontSize: 22,
          lineHeight: 1.3,
          color: '#ede9fe',
          marginBottom: { xs: 3, md: 4 },
          textAlign: 'center',
        }}
      >
        On Osra so far
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 48, sm: 80 },
          maxWidth: 800,
          margin: '0 auto',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            component="div"
            sx={{
              fontFamily: '"Lora", Georgia, serif',
              fontSize: { xs: 56, md: 72 },
              fontWeight: 800,
              color: '#ede9fe',
              lineHeight: 1,
            }}
          >
            {displayIndividuals}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Lora", Georgia, serif',
              fontSize: { xs: 14, md: 16 },
              fontWeight: 400,
              color: '#7c5cbf',
              marginTop: 1,
            }}
          >
            Individuals
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            component="div"
            sx={{
              fontFamily: '"Lora", Georgia, serif',
              fontSize: { xs: 56, md: 72 },
              fontWeight: 800,
              color: '#ede9fe',
              lineHeight: 1,
            }}
          >
            {displayFamilies}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Lora", Georgia, serif',
              fontSize: { xs: 14, md: 16 },
              fontWeight: 400,
              color: '#7c5cbf',
              marginTop: 1,
            }}
          >
            Families
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
