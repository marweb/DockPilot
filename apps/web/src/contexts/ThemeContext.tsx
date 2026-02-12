import { createContext, useContext, ReactNode, useEffect, useCallback, useState } from 'react';
import { useThemeStore } from '../stores/theme';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

/**
 * Theme context value type
 */
interface ThemeContextValue {
  /** Current theme setting */
  theme: Theme;
  /** Actual theme applied (resolves 'system' to 'light' or 'dark') */
  resolvedTheme: ResolvedTheme;
  /** Set theme to a specific value */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark */
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
  /** Whether system theme is selected */
  isSystem: boolean;
}

/**
 * Theme context
 */
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Theme provider props
 */
interface ThemeProviderProps {
  children: ReactNode;
  /** Storage key for theme preference */
  storageKey?: string;
  /** Disable transitions during theme switch */
  disableTransitionOnChange?: boolean;
}

/**
 * Get system theme preference
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Theme Provider component
 * Provides theme state and methods to the application
 * Integrates with Zustand theme store
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ThemeProvider defaultTheme="system">
 *       <Router>
 *         <Routes />
 *       </Router>
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export function ThemeProvider({
  children,
  disableTransitionOnChange = false,
}: ThemeProviderProps): JSX.Element {
  const store = useThemeStore();
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  /**
   * Initialize theme on mount
   */
  useEffect(() => {
    store.initTheme();
    setMounted(true);
  }, []);

  /**
   * Update resolved theme when theme changes
   */
  useEffect(() => {
    const updateResolvedTheme = () => {
      if (store.theme === 'system') {
        setResolvedTheme(getSystemTheme());
      } else {
        setResolvedTheme(store.theme);
      }
    };

    updateResolvedTheme();

    // Listen for system theme changes
    if (store.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [store.theme]);

  /**
   * Apply theme to document
   */
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const isDark = resolvedTheme === 'dark';

    if (disableTransitionOnChange) {
      root.classList.add('transition-none');
    }

    root.classList.toggle('dark', isDark);

    if (disableTransitionOnChange) {
      // Force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      root.offsetHeight;
      root.classList.remove('transition-none');
    }
  }, [resolvedTheme, mounted, disableTransitionOnChange]);

  /**
   * Set theme
   */
  const setTheme = useCallback(
    (theme: Theme): void => {
      store.setTheme(theme);
    },
    [store]
  );

  /**
   * Toggle between light and dark
   */
  const toggleTheme = useCallback((): void => {
    const current = store.theme === 'system' ? getSystemTheme() : store.theme;
    store.setTheme(current === 'dark' ? 'light' : 'dark');
  }, [store]);

  /**
   * Set specific themes
   */
  const setLight = useCallback((): void => {
    store.setTheme('light');
  }, [store]);

  const setDark = useCallback((): void => {
    store.setTheme('dark');
  }, [store]);

  const setSystem = useCallback((): void => {
    store.setTheme('system');
  }, [store]);

  const isDark = resolvedTheme === 'dark';
  const isLight = resolvedTheme === 'light';
  const isSystem = store.theme === 'system';

  const value: ThemeContextValue = {
    theme: store.theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    setLight,
    setDark,
    setSystem,
    isDark,
    isLight,
    isSystem,
  };

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access theme context
 * Must be used within ThemeProvider
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { theme, toggleTheme, isDark } = useThemeContext();
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       {isDark ? '🌙 Dark' : '☀️ Light'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }

  return context;
}

export default ThemeContext;
