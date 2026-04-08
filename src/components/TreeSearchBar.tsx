import React, { useRef, useEffect, useCallback } from 'react';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import type { FamilyNode } from '../types/graph';

interface TreeSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  matches: FamilyNode[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** When true, render inline in a panel (no absolute positioning) */
  embedded?: boolean;
  /** Increment to trigger focus on the input (e.g. when Ctrl+F opens search) */
  focusTrigger?: number;
}

export function TreeSearchBar({
  query,
  onQueryChange,
  matches,
  currentIndex,
  onPrev,
  onNext,
  onClose,
  disabled = false,
  placeholder = 'Search names (Ar/En)...',
  embedded = false,
  focusTrigger = 0,
}: TreeSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusTrigger > 0 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focusTrigger]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          onPrev();
        } else {
          onNext();
        }
      }
    },
    [onClose, onPrev, onNext]
  );

  const hasMatches = matches.length > 0;
  const canNavigate = hasMatches;

  const textFieldSx = {
    width: '100%',
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'rgba(0,0,0,0.3)',
      color: '#fff',
      fontFamily: '"Inter", sans-serif',
      letterSpacing: '0.02em',
      '& fieldset': { borderColor: 'rgba(212, 175, 55, 0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(212, 175, 55, 0.3)' },
      '&.Mui-focused fieldset': { borderColor: 'rgba(212, 175, 55, 0.5)' },
    },
  };

  const controlsRow = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
      <Typography 
        variant="caption" 
        sx={{ 
          color: 'primary.main', 
          minWidth: 45, 
          fontFamily: 'monospace',
          fontWeight: 600,
          textAlign: 'center',
          background: 'rgba(212, 175, 55, 0.1)',
          px: 1,
          py: 0.5,
          borderRadius: '4px'
        }}
      >
        {hasMatches ? `${currentIndex + 1}/${matches.length}` : '0/0'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={onPrev}
          disabled={!canNavigate}
          aria-label="Previous match"
          sx={{ 
            color: 'white',
            background: 'rgba(255,255,255,0.05)',
            '&:hover': { background: 'rgba(255,255,255,0.1)' },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' }
          }}
        >
          ‹
        </IconButton>
        <IconButton
          size="small"
          onClick={onNext}
          disabled={!canNavigate}
          aria-label="Next match"
          sx={{ 
            color: 'white',
            background: 'rgba(255,255,255,0.05)',
            '&:hover': { background: 'rgba(255,255,255,0.1)' },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' }
          }}
        >
          ›
        </IconButton>
      </Box>
    </Box>
  );

  if (embedded) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
        <TextField
          inputRef={inputRef}
          size="small"
          variant="outlined"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a family to search' : placeholder}
          disabled={disabled}
          slotProps={{
            htmlInput: {
              dir: 'auto',
              'aria-label': 'Search family tree',
            }
          }}
          sx={textFieldSx}
        />
        {controlsRow}
      </Box>
    );
  }

  const containerSx = {
    position: 'absolute' as const,
    top: 24,
    left: 24,
    zIndex: 1000,
    p: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.7)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  };

  return (
    <Box sx={containerSx}>
      <TextField
        inputRef={inputRef}
        size="small"
        variant="outlined"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Select a family to search' : placeholder}
        disabled={disabled}
        slotProps={{
          htmlInput: {
            dir: 'auto',
            'aria-label': 'Search family tree',
          }
        }}
        sx={{ flex: 1, minWidth: 220, ...textFieldSx }}
      />
      {controlsRow}
    </Box>
  );
}
