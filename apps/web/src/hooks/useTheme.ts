import { useCallback, useEffect, useState } from 'react';
import { useThemeStore } from '../stores/theme';

type Theme = 'light' | 'dark' | 'system';

/**
 * Theme hook return type
 */
interface UseThemeReturn {
  /** Current theme setting */
  theme: Theme;
  /** Actual theme applied (resolves 'system' to 'light' or 'dark') */
  resolvedTheme: 'light' | 'dark';
  /** Set theme to a specific value */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void;
  /** Set theme to light */
  setLight: () => void;
  /** Set theme to dark */
  setDark: () => void;
  /** Set theme to system preference */
  setSystem: () => void;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Whether light mode is active */
  isLight: boolean;
}

/**
 * Get system theme preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Hook for managing theme state
 * Integrates with Zustand theme store
 * Provides convenient theme switching functions
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { theme, toggleTheme, isDark } = useTheme();
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       {isDark ? '🌙' : '☀️'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme(): UseThemeReturn {
  const { theme, setTheme: setStoreTheme, initTheme } = useThemeStore();
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  /**
   * Initialize theme on mount
   */
  useEffect(() => {
    initTheme();
  }, [initTheme]);

  /**
   * Update resolved theme when theme changes
   */
  useEffect(() => {
    if (theme === 'system') {
      setResolvedTheme(getSystemTheme());

      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  /**
   * Set theme to specific value
   */
  const setTheme = useCallback(
    (newTheme: Theme): void => {
      setStoreTheme(newTheme);
    },
    [setStoreTheme]
  );

  /**
   * Toggle between light and dark themes
   * If currently system, switches to the opposite of system preference
   */
  const toggleTheme = useCallback((): void => {
    const currentResolved = theme === 'system' ? getSystemTheme() : theme;
    setStoreTheme(currentResolved === 'dark' ? 'light' : 'dark');
  }, [theme, setStoreTheme]);

  /**
   * Set theme to light
   */
  const setLight = useCallback((): void => {
    setStoreTheme('light');
  }, [setStoreTheme]);

  /**
   * Set theme to dark
   */
  const setDark = useCallback((): void => {
    setStoreTheme('dark');
  }, [setStoreTheme]);

  /**
   * Set theme to system preference
   */
  const setSystem = useCallback((): void => {
    setStoreTheme('system');
  }, [setStoreTheme]);

  const isDark = resolvedTheme === 'dark';
  const isLight = resolvedTheme === 'light';

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    setLight,
    setDark,
    setSystem,
    isDark,
    isLight,
  };
}

export default useTheme;
