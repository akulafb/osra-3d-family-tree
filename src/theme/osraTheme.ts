import { createTheme } from '@mui/material/styles';

export const osraTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7c3aed',
      dark: '#6d28d9',
      light: '#c4b5fd',
    },
    secondary: {
      main: '#9333ea',
    },
    success: {
      main: '#10b981',
    },
    error: {
      main: '#ef4444',
    },
    warning: {
      main: '#f59e0b',
    },
    background: {
      default: '#0a0a0a',
    },
    text: {
      primary: '#ede9fe',
    },
  },
});
