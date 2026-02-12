import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  Box,
  Image,
  HardDrive,
  Network,
  Hammer,
  Layers,
  Globe,
  Settings,
  MoreHorizontal,
  X,
} from 'lucide-react';
import clsx from 'clsx';

interface MobileNavProps {
  className?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  primary?: boolean;
}

const primaryNavItems: NavItem[] = [
  { name: 'dashboard', href: '/', icon: Home, primary: true },
  { name: 'containers', href: '/containers', icon: Box, primary: true },
  { name: 'images', href: '/images', icon: Image, primary: true },
  { name: 'settings', href: '/settings', icon: Settings, primary: true },
];

const secondaryNavItems: NavItem[] = [
  { name: 'volumes', href: '/volumes', icon: HardDrive },
  { name: 'networks', href: '/networks', icon: Network },
  { name: 'builds', href: '/builds', icon: Hammer },
  { name: 'compose', href: '/compose', icon: Layers },
  { name: 'tunnels', href: '/tunnels', icon: Globe },
];

export default function MobileNav({ className = '' }: MobileNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <>
      <nav
        className={clsx(
          'fixed bottom-0 left-0 right-0 z-40',
          'bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700',
          'lg:hidden',
          className
        )}
      >
        <div className="flex items-center justify-around h-16">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'flex flex-col items-center justify-center flex-1 h-full',
                  'transition-colors',
                  active
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                <Icon className={clsx('h-6 w-6', active && 'fill-current')} />
                <span className="text-xs mt-1">{t(`nav.${item.name}`)}</span>
                {active && (
                  <div className="absolute bottom-0 h-0.5 w-8 bg-primary-600 rounded-full" />
                )}
              </Link>
            );
          })}

          <button
            onClick={() => setShowMore(true)}
            className={clsx(
              'flex flex-col items-center justify-center flex-1 h-full',
              'text-gray-500 dark:text-gray-400'
            )}
          >
            <MoreHorizontal className="h-6 w-6" />
            <span className="text-xs mt-1">{t('common.more')}</span>
          </button>
        </div>
      </nav>

      {/* Bottom Sheet for more options */}
      <div
        className={clsx(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-300',
          showMore ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowMore(false)} />
        <div
          className={clsx(
            'absolute bottom-0 left-0 right-0',
            'bg-white dark:bg-gray-800 rounded-t-2xl',
            'transform transition-transform duration-300 ease-out',
            showMore ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('common.moreOptions')}
            </h3>
            <button
              onClick={() => setShowMore(false)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 grid grid-cols-3 gap-4">
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setShowMore(false)}
                  className={clsx(
                    'flex flex-col items-center justify-center p-4 rounded-xl',
                    'transition-colors',
                    active
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <Icon className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">{t(`nav.${item.name}`)}</span>
                </Link>
              );
            })}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">DockPilot v1.0.0</p>
          </div>
        </div>
      </div>
    </>
  );
}
