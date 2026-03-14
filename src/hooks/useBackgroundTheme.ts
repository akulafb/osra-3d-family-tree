import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'family-tree-background-theme';

export type BackgroundTheme = 'deep-space' | 'wax-white' | 'smooth-sepia' | 'baby-blue';

const VALID_THEMES: BackgroundTheme[] = ['deep-space', 'wax-white', 'smooth-sepia', 'baby-blue'];

export function useBackgroundTheme() {
  const [theme, setThemeState] = useState<BackgroundTheme>('deep-space');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_THEMES.includes(stored as BackgroundTheme)) {
        setThemeState(stored as BackgroundTheme);
      }
    } catch (e) {
      console.warn('[useBackgroundTheme] Failed to load stored preference:', e);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {
        console.warn('[useBackgroundTheme] Failed to save preference:', e);
      }
    }
  }, [theme, isHydrated]);

  const setTheme = useCallback((newTheme: BackgroundTheme) => {
    setThemeState(newTheme);
  }, []);

  return {
    theme,
    setTheme,
    isHydrated,
  };
}
