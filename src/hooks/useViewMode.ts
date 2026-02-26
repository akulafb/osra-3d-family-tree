import { useState, useCallback, useEffect } from 'react';
import { LayoutType } from '../types/graph';

const STORAGE_KEY = 'family-tree-view-mode';

export interface ViewModeState {
  mode: '3D' | '2D';
  layout: LayoutType;
}

export function useViewMode() {
  const [mode, setMode] = useState<'3D' | '2D'>('3D');
  const [layout, setLayout] = useState<LayoutType>('tree');
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ViewModeState;
        if (parsed.mode === '2D' || parsed.mode === '3D') {
          setMode(parsed.mode);
        }
        if (['tree', 'cluster', 'radial'].includes(parsed.layout)) {
          setLayout(parsed.layout);
        }
      }
    } catch (e) {
      console.warn('[useViewMode] Failed to load stored preference:', e);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (isHydrated) {
      try {
        const state: ViewModeState = { mode, layout };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn('[useViewMode] Failed to save preference:', e);
      }
    }
  }, [mode, layout, isHydrated]);

  const switchMode = useCallback((newMode: '3D' | '2D') => {
    setMode(newMode);
  }, []);

  const switchLayout = useCallback((newLayout: LayoutType) => {
    setLayout(newLayout);
  }, []);

  return {
    mode,
    layout,
    isHydrated,
    switchMode,
    switchLayout,
    is2D: mode === '2D',
    is3D: mode === '3D',
  };
}
