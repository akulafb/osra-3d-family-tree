import React, { useRef, useEffect, useCallback } from 'react';
import Paper from '@mui/material/Paper';
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
      backgroundColor: 'rgba(0,0,0,0.2)',
      color: '#fff',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
    },
  };

  const controlsRow = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 36 }}>
        {hasMatches ? `${currentIndex + 1} / ${matches.length}` : '0 / 0'}
      </Typography>
      <IconButton
        size="small"
        onClick={onPrev}
        disabled={!canNavigate}
        aria-label="Previous match"
        sx={{ color: 'rgba(255,255,255,0.8)' }}
      >
        ‹
      </IconButton>
      <IconButton
        size="small"
        onClick={onNext}
        disabled={!canNavigate}
        aria-label="Next match"
        sx={{ color: 'rgba(255,255,255,0.8)' }}
      >
        ›
      </IconButton>
    </Box>
  );

  if (embedded) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
        <TextField
          inputRef={inputRef}
          size="small"
          variant="outlined"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a family to search' : placeholder}
          disabled={disabled}
          inputProps={{
            dir: 'auto',
            'aria-label': 'Search family tree',
          }}
          sx={textFieldSx}
        />
        {controlsRow}
      </Box>
    );
  }

  const containerSx = {
    position: 'absolute' as const,
    top: 20,
    left: 20,
    zIndex: 10,
    p: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  return (
    <Paper elevation={3} sx={containerSx}>
      <TextField
        inputRef={inputRef}
        size="small"
        variant="outlined"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Select a family to search' : placeholder}
        disabled={disabled}
        inputProps={{
          dir: 'auto',
          'aria-label': 'Search family tree',
        }}
        sx={{ flex: 1, minWidth: 180, ...textFieldSx }}
      />
      {controlsRow}
    </Paper>
  );
}
