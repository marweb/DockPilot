/**
 * Contexts exports
 * Centralized exports for all React contexts
 */

// Auth Context
export { AuthProvider, useAuthContext, default as AuthContext } from './AuthContext';

// Theme Context
export { ThemeProvider, useThemeContext, default as ThemeContext } from './ThemeContext';

// Locale Context
export { LocaleProvider, useLocaleContext, default as LocaleContext } from './LocaleContext';
export type { Locale, Language } from './LocaleContext';

// Legacy exports for backward compatibility
export { useAuthContext as useAuth } from './AuthContext';
export { useThemeContext as useTheme } from './ThemeContext';
export { useLocaleContext as useLocale } from './LocaleContext';

// Other contexts
export { QueryProvider, useQueryClient } from './QueryContext';
export { ToastProvider, useToast } from './ToastContext';
export { ErrorProvider, ErrorBoundary } from './ErrorContext';
