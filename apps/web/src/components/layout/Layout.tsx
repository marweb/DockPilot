import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigation as useRouterNavigation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Menu,
  X,
  Home,
  Box,
  ImageIcon,
  HardDrive,
  Network,
  Hammer,
  Layers,
  Globe,
  Settings,
  LogOut,
  Moon,
  Sun,
  Monitor,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useThemeStore } from '../../stores/theme';
import api from '../../api/client';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navigationItems: NavItem[] = [
  { name: 'dashboard', href: '/', icon: Home },
  { name: 'containers', href: '/containers', icon: Box },
  { name: 'images', href: '/images', icon: ImageIcon },
  { name: 'volumes', href: '/volumes', icon: HardDrive },
  { name: 'networks', href: '/networks', icon: Network },
  { name: 'builds', href: '/builds', icon: Hammer },
  { name: 'compose', href: '/compose', icon: Layers },
  { name: 'tunnels', href: '/tunnels', icon: Globe },
  { name: 'settings', href: '/settings', icon: Settings },
];

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
];

/**
 * ScrollRestoration Component
 * Restaura la posición del scroll al navegar
 */
function ScrollRestoration() {
  const location = useLocation();
  const routerNavigation = useRouterNavigation();

  useEffect(() => {
    if (routerNavigation.state === 'idle') {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, routerNavigation.state]);

  return null;
}

/**
 * Layout principal de la aplicación
 * - Integra Header, Sidebar, Footer
 * - Área de contenido principal con transiciones
 * - Manejo de estado del sidebar
 * - Responsive layout
 * - Scroll restoration
 */
export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const routerNavigation = useRouterNavigation();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('...');
  const currentYear = new Date().getFullYear();

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.lang-menu')) setLangMenuOpen(false);
      if (!target.closest('.theme-menu')) setThemeMenuOpen(false);
      if (!target.closest('.user-menu')) setUserMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cerrar sidebar móvil al cambiar de ruta
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    api
      .get('/system/version')
      .then((res) => {
        setAppVersion(res.data?.data?.currentVersion || '...');
      })
      .catch(() => {
        setAppVersion('...');
      });
  }, []);

  const isLoading = routerNavigation.state === 'loading';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ScrollRestoration />

      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="fixed inset-0 bg-gray-600/75 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={`fixed inset-y-0 left-0 flex w-64 flex-col bg-white dark:bg-gray-800 transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
            <Link to="/" className="flex items-center">
              <img
                src="/logo.png"
                alt="DockPilot"
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive(item.href)
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-r-2 border-primary-600'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <item.icon
                  className={`h-5 w-5 mr-3 ${isActive(item.href) ? 'text-primary-600 dark:text-primary-400' : ''}`}
                />
                {t(`nav.${item.name}`)}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-400">DockPilot v{appVersion}</div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex h-16 items-center px-4 border-b border-gray-200 dark:border-gray-700">
            <Link to="/" className="flex items-center">
              <img
                src="/logo.png"
                alt="DockPilot"
                className="h-10 w-auto max-w-[180px] object-contain"
              />
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive(item.href)
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-r-2 border-primary-600'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <item.icon
                  className={`h-5 w-5 mr-3 ${isActive(item.href) ? 'text-primary-600 dark:text-primary-400' : ''}`}
                />
                {t(`nav.${item.name}`)}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-400">DockPilot v{appVersion}</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <nav className="hidden md:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>DockPilot</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 dark:text-gray-100 capitalize">
              {location.pathname === '/' ? 'Dashboard' : location.pathname.split('/')[1]}
            </span>
          </nav>

          <div className="flex-1" />

          {/* Language selector */}
          <div className="relative lang-menu">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-2 p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-sm font-medium">
                {languages.find((l) => l.code === i18n.language)?.name || 'EN'}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 animate-fade-in">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      i18n.changeLanguage(lang.code);
                      setLangMenuOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                      i18n.language === lang.code
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme selector */}
          <div className="relative theme-menu">
            <button
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'light' && <Sun className="h-5 w-5" />}
              {theme === 'dark' && <Moon className="h-5 w-5" />}
              {theme === 'system' && <Monitor className="h-5 w-5" />}
            </button>
            {themeMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 animate-fade-in">
                <button
                  onClick={() => {
                    setTheme('light');
                    setThemeMenuOpen(false);
                  }}
                  className={`flex items-center w-full text-left px-4 py-2 text-sm transition-colors ${
                    theme === 'light'
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Sun className="h-4 w-4 mr-2" />
                  {t('theme.light')}
                </button>
                <button
                  onClick={() => {
                    setTheme('dark');
                    setThemeMenuOpen(false);
                  }}
                  className={`flex items-center w-full text-left px-4 py-2 text-sm transition-colors ${
                    theme === 'dark'
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Moon className="h-4 w-4 mr-2" />
                  {t('theme.dark')}
                </button>
                <button
                  onClick={() => {
                    setTheme('system');
                    setThemeMenuOpen(false);
                  }}
                  className={`flex items-center w-full text-left px-4 py-2 text-sm transition-colors ${
                    theme === 'system'
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  {t('theme.system')}
                </button>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative user-menu">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300">
                {user?.username}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 animate-fade-in">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user?.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.role || 'Administrator'}
                  </p>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {t('nav.settings')}
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                  }}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('auth.logout')}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content with transitions */}
        <main className="flex-1 p-4 lg:p-6 relative">
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm z-10 flex items-start justify-center pt-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          )}

          {/* Content with fade transition */}
          <div
            className={`transition-all duration-300 ${
              isLoading ? 'opacity-50 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
          >
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 lg:px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
            <p>
              © {currentYear} DockPilot. {t('footer.allRightsReserved')}
            </p>
            <div className="flex items-center gap-4">
              <Link to="/settings" className="hover:text-primary-600 transition-colors">
                {t('footer.documentation')}
              </Link>
              <Link to="/settings" className="hover:text-primary-600 transition-colors">
                {t('footer.support')}
              </Link>
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                v{appVersion}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
