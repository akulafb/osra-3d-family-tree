import { ReactNode } from 'react';
import { useSpring, animated } from 'react-spring';
import Button from '@mui/material/Button';

interface ExpandablePanelProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  sx?: object;
}

export function ExpandablePanel({
  label,
  isOpen,
  onToggle,
  children,
  variant = 'contained',
  color = 'primary',
  sx,
}: ExpandablePanelProps) {
  const spring = useSpring({
    maxHeight: isOpen ? 800 : 0,
    opacity: isOpen ? 1 : 0,
    config: { tension: 300, friction: 30 },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Button
        variant={variant}
        color={color}
        onClick={onToggle}
        sx={{ justifyContent: 'flex-start', ...sx }}
      >
        {label} {isOpen ? '▴' : '▾'}
      </Button>
      <animated.div
        style={{
          ...spring,
          overflow: 'hidden',
        }}
      >
        {children}
      </animated.div>
    </div>
  );
}
