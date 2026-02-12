import { createContext, useContext, ReactNode, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Supported locale codes
 */
export type Locale = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ru' | 'ja';

/**
 * Language metadata
 */
export interface Language {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

/**
 * Available languages
 */
export const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', dir: 'ltr' },
];

/**
 * Locale context value type
 */
interface LocaleContextValue {
  /** Current locale code */
  locale: Locale;
  /** Current language metadata */
  currentLanguage: Language;
  /** All available languages */
  languages: Language[];
  /** Change locale */
  setLocale: (locale: Locale) => Promise<void>;
  /** Change locale by code */
  changeLanguage: (code: Locale) => Promise<void>;
  /** Get language by code */
  getLanguage: (code: Locale) => Language | undefined;
  /** Format date according to locale */
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  /** Format number according to locale */
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  /** Format currency according to locale */
  formatCurrency: (amount: number, currency?: string) => string;
  /** Format relative time */
  formatRelativeTime: (date: Date | number) => string;
  /** Whether locale is loading */
  isLoading: boolean;
  /** Translation function */
  t: (key: string, options?: Record<string, unknown>) => string;
}

/**
 * Locale context
 */
const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

/**
 * Locale provider props
 */
interface LocaleProviderProps {
  children: ReactNode;
  /** Default locale if none is detected */
  defaultLocale?: Locale;
  /** Storage key for locale preference */
  storageKey?: string;
}

/**
 * Get browser locale
 */
function getBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';

  const browserLang = navigator.language.split('-')[0];
  const supportedLocales: Locale[] = ['en', 'es', 'fr', 'de', 'zh', 'ru', 'ja'];

  return supportedLocales.includes(browserLang as Locale) ? (browserLang as Locale) : 'en';
}

/**
 * Locale Provider component
 * Provides internationalization state and methods to the application
 * Integrates with i18next for translations
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <LocaleProvider defaultLocale="en">
 *       <Router>
 *         <Routes />
 *       </Router>
 *     </LocaleProvider>
 *   );
 * }
 * ```
 */
export function LocaleProvider({
  children,
  defaultLocale = 'en',
}: LocaleProviderProps): JSX.Element {
  const { i18n, t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [locale, setLocaleState] = useState<Locale>(
    (i18n.language as Locale) || defaultLocale || getBrowserLocale()
  );
  const [mounted, setMounted] = useState(false);

  /**
   * Initialize locale
   */
  useEffect(() => {
    const detectedLocale = (i18n.language as Locale) || getBrowserLocale();
    setLocaleState(detectedLocale);

    // Set document lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = detectedLocale;
    }

    setMounted(true);
  }, [i18n.language, defaultLocale]);

  /**
   * Update locale when i18n language changes
   */
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setLocaleState(lng as Locale);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lng;
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  /**
   * Change locale/language
   */
  const changeLanguage = useCallback(
    async (code: Locale): Promise<void> => {
      setIsLoading(true);
      try {
        await i18n.changeLanguage(code);
        setLocaleState(code);
      } finally {
        setIsLoading(false);
      }
    },
    [i18n]
  );

  /**
   * Set locale (alias for changeLanguage)
   */
  const setLocale = useCallback(
    async (newLocale: Locale): Promise<void> => {
      await changeLanguage(newLocale);
    },
    [changeLanguage]
  );

  /**
   * Get language metadata by code
   */
  const getLanguage = useCallback((code: Locale): Language | undefined => {
    return AVAILABLE_LANGUAGES.find((lang) => lang.code === code);
  }, []);

  /**
   * Format date according to current locale
   */
  const formatDate = useCallback(
    (date: Date | number, options: Intl.DateTimeFormatOptions = {}): string => {
      const dateObj = typeof date === 'number' ? new Date(date) : date;
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options,
      }).format(dateObj);
    },
    [locale]
  );

  /**
   * Format number according to current locale
   */
  const formatNumber = useCallback(
    (num: number, options: Intl.NumberFormatOptions = {}): string => {
      return new Intl.NumberFormat(locale, options).format(num);
    },
    [locale]
  );

  /**
   * Format currency according to current locale
   */
  const formatCurrency = useCallback(
    (amount: number, currency = 'USD'): string => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).format(amount);
    },
    [locale]
  );

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  const formatRelativeTime = useCallback(
    (date: Date | number): string => {
      const dateObj = typeof date === 'number' ? new Date(date) : date;
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

      if (diffInSeconds < 60) {
        return rtf.format(-diffInSeconds, 'second');
      } else if (diffInSeconds < 3600) {
        return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
      } else if (diffInSeconds < 86400) {
        return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
      } else if (diffInSeconds < 2592000) {
        return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
      } else if (diffInSeconds < 31536000) {
        return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
      } else {
        return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
      }
    },
    [locale]
  );

  const currentLanguage = getLanguage(locale) || AVAILABLE_LANGUAGES[0];

  const value: LocaleContextValue = {
    locale,
    currentLanguage,
    languages: AVAILABLE_LANGUAGES,
    setLocale,
    changeLanguage,
    getLanguage,
    formatDate,
    formatNumber,
    formatCurrency,
    formatRelativeTime,
    isLoading,
    t,
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Hook to access locale context
 * Must be used within LocaleProvider
 *
 * @example
 * ```tsx
 * function LanguageSelector() {
 *   const { locale, languages, changeLanguage, t } = useLocaleContext();
 *
 *   return (
 *     <div>
 *       <p>{t('select_language')}</p>
 *       <select value={locale} onChange={(e) => changeLanguage(e.target.value as Locale)}>
 *         {languages.map(lang => (
 *           <option key={lang.code} value={lang.code}>
 *             {lang.flag} {lang.nativeName}
 *           </option>
 *         ))}
 *       </select>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext);

  if (context === undefined) {
    throw new Error('useLocaleContext must be used within a LocaleProvider');
  }

  return context;
}

export default LocaleContext;
