import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings as SettingsIcon,
  Shield,
  Clock,
  ArrowUpCircle,
  Loader2,
  Info,
  KeyRound,
  PartyPopper,
  Globe,
  Bell,
  Server,
  Lock,
  Eye,
  EyeOff,
  Save,
  ChevronDown,
} from 'lucide-react';
import api from '../api/client';
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettings as SystemSettingsType,
} from '../api/system';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import NotificationsSection from './Settings/NotificationsSection';
import EventsMatrix from './Settings/EventsMatrix';

interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  checkedAt: string;
}

interface UpgradeStatus {
  inProgress: boolean;
  completed?: boolean;
  exitCode?: number;
  targetVersion?: string;
  containerId?: string;
  startedAt?: string;
}

type TabId = 'general' | 'notifications' | 'events' | 'version' | 'security';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

// Regex patterns for validation
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX =
  /^(?:(?:[a-fA-F\d]{1,4}:){7}(?:[a-fA-F\d]{1,4}|:)|(?:[a-fA-F\d]{1,4}:){6}(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|:[a-fA-F\d]{1,4}|:)|(?:[a-fA-F\d]{1,4}:){5}(?::(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,2}|:)|(?:[a-fA-F\d]{1,4}:){4}(?:(?::[a-fA-F\d]{1,4}){0,1}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,3}|:)|(?:[a-fA-F\d]{1,4}:){3}(?:(?::[a-fA-F\d]{1,4}){0,2}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,4}|:)|(?:[a-fA-F\d]{1,4}:){2}(?:(?::[a-fA-F\d]{1,4}){0,3}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,5}|:)|(?:[a-fA-F\d]{1,4}:){1}(?:(?::[a-fA-F\d]{1,4}){0,4}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,6}|:)|(?::(?:(?::[a-fA-F\d]{1,4}){0,5}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,7}|:)))(?:%[0-9a-zA-Z]{1,})?$/;
const URL_REGEX =
  /^https?:\/\/(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?::[0-9]{1,5})?(?:\/[\w\-.~%!$&'()*+,;=:@/]*)*$/;

export default function Settings() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Version & Updates state
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [upgradeStatus, setUpgradeStatus] = useState<UpgradeStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState(0);
  const [upgradeStepKey, setUpgradeStepKey] = useState('settings.upgradeProgressPreparing');
  const [showUpgradeConfirmModal, setShowUpgradeConfirmModal] = useState(false);
  const [showUpgradeSuccessModal, setShowUpgradeSuccessModal] = useState(false);

  // General Settings state
  const [systemSettings, setSystemSettings] = useState<SystemSettingsType | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Form state for General settings
  const [formData, setFormData] = useState({
    instanceName: '',
    publicUrl: '',
    timezone: 'UTC',
    publicIPv4: '',
    publicIPv6: '',
    autoUpdate: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showIPv4, setShowIPv4] = useState(false);
  const [showIPv6, setShowIPv6] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [isTimezoneDropdownOpen, setIsTimezoneDropdownOpen] = useState(false);
  const timezoneDropdownRef = useRef<HTMLDivElement>(null);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Error state
  const [error, setError] = useState('');

  // Get timezones
  const timezones =
    typeof Intl !== 'undefined' &&
    (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
      ? (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
          'timeZone'
        )
      : [
          'UTC',
          'America/New_York',
          'America/Los_Angeles',
          'Europe/London',
          'Europe/Paris',
          'Asia/Tokyo',
          'Asia/Shanghai',
          'Australia/Sydney',
        ];

  const filteredTimezones = timezoneSearch
    ? timezones.filter((tz: string) => tz.toLowerCase().includes(timezoneSearch.toLowerCase()))
    : timezones;

  const tabs: Tab[] = [
    { id: 'general', label: t('settings.tabs.general'), icon: <Globe className="h-4 w-4" /> },
    {
      id: 'notifications',
      label: t('settings.tabs.notifications'),
      icon: <Bell className="h-4 w-4" />,
    },
    {
      id: 'events',
      label: t('settings.tabs.events'),
      icon: <Bell className="h-4 w-4" />,
    },
    {
      id: 'version',
      label: t('settings.tabs.versionAndUpdates'),
      icon: <Server className="h-4 w-4" />,
    },
    { id: 'security', label: t('settings.tabs.security'), icon: <Lock className="h-4 w-4" /> },
  ];

  // Close timezone dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        timezoneDropdownRef.current &&
        !timezoneDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTimezoneDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Warn about unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Fetch current version info
  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    setError('');
    try {
      const response = await api.get('/system/check-update');
      setVersionInfo(response.data.data);
    } catch {
      setError(t('settings.updateCheckFailed'));
    } finally {
      setChecking(false);
    }
  }, [t]);

  // Fetch system settings
  const fetchSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const settings = await getSystemSettings();
      setSystemSettings(settings);
      setFormData({
        instanceName: settings.instanceName || '',
        publicUrl: settings.publicUrl || '',
        timezone: settings.timezone || 'UTC',
        publicIPv4: settings.publicIPv4 || '',
        publicIPv6: settings.publicIPv6 || '',
        autoUpdate: settings.autoUpdate || false,
      });
      setHasUnsavedChanges(false);
    } catch {
      // Settings may not exist yet, use defaults
      showToast(t('settings.settingsSaveFailed'), 'error');
    } finally {
      setIsLoadingSettings(false);
    }
  }, [showToast, t]);

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Instance Name validation
    if (!formData.instanceName.trim()) {
      newErrors.instanceName = t('settings.general.instanceNameRequired');
    } else if (formData.instanceName.length > 100) {
      newErrors.instanceName = t('settings.general.instanceNameMaxLength');
    }

    // Public URL validation (optional)
    if (formData.publicUrl && !URL_REGEX.test(formData.publicUrl)) {
      newErrors.publicUrl = t('settings.general.publicUrlInvalid');
    }

    // Timezone validation
    if (!formData.timezone) {
      newErrors.timezone = t('settings.general.timezoneRequired');
    }

    // IPv4 validation (optional)
    if (formData.publicIPv4 && !IPV4_REGEX.test(formData.publicIPv4)) {
      newErrors.publicIPv4 = t('settings.general.publicIPv4Invalid');
    }

    // IPv6 validation (optional)
    if (formData.publicIPv6 && !IPV6_REGEX.test(formData.publicIPv6)) {
      newErrors.publicIPv6 = t('settings.general.publicIPv6Invalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form field changes
  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      setHasUnsavedChanges(true);
      return newData;
    });
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Save general settings
  const saveSettings = async () => {
    if (!validateForm()) {
      showToast(t('settings.settingsSaveFailed'), 'error');
      return;
    }

    setIsSavingSettings(true);
    setError('');

    try {
      const updatedSettings = await updateSystemSettings({
        instanceName: formData.instanceName,
        publicUrl: formData.publicUrl || undefined,
        timezone: formData.timezone,
        publicIPv4: formData.publicIPv4 || undefined,
        publicIPv6: formData.publicIPv6 || undefined,
        autoUpdate: formData.autoUpdate,
      });

      setSystemSettings(updatedSettings);
      setHasUnsavedChanges(false);
      showToast(t('settings.settingsSaved'), 'success');
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      showToast(apiErr?.message || t('settings.settingsSaveFailed'), 'error');
      setError(apiErr?.message || t('settings.settingsSaveFailed'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Change password
  const changePassword = async () => {
    setError('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError(t('settings.passwordAllRequired'));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(t('settings.passwordMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('settings.passwordMinLength'));
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast(t('settings.passwordChanged'), 'success');
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message;
      setError(message || t('settings.passwordChangeFailed'));
      showToast(message || t('settings.passwordChangeFailed'), 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  // Trigger upgrade
  const triggerUpgrade = async () => {
    if (!versionInfo?.latestVersion) return;

    setShowUpgradeConfirmModal(false);

    setUpgrading(true);
    setUpgradeProgress(12);
    setUpgradeStepKey('settings.upgradeProgressPreparing');
    setError('');
    try {
      await api.post('/system/upgrade', {
        version: versionInfo.latestVersion,
      });
      setUpgradeStatus({
        inProgress: true,
        targetVersion: versionInfo.latestVersion,
      });
      setUpgradeProgress(24);
      setUpgradeStepKey('settings.upgradeProgressDownloading');
      // Start polling for upgrade status
      pollUpgradeStatus();
    } catch (err: unknown) {
      const apiErr = err as { message?: string; code?: string };
      if (apiErr?.code === 'UPGRADE_IN_PROGRESS') {
        setError(t('settings.upgradeAlreadyInProgress'));
      } else {
        setError(apiErr?.message || t('settings.upgradeFailed'));
      }
      setUpgradeProgress(0);
      setUpgrading(false);
    }
  };

  // Poll upgrade status
  const pollUpgradeStatus = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (every 5s)

    const poll = async () => {
      attempts++;
      try {
        const response = await api.get('/system/upgrade-status');
        const status = response.data.data as UpgradeStatus;
        setUpgradeStatus(status);

        if (status.inProgress && attempts < maxAttempts) {
          const estimated = Math.min(92, 24 + attempts * 6);
          setUpgradeProgress((prev) => Math.max(prev, estimated));
          setUpgradeStepKey('settings.upgradeProgressDownloading');
          setTimeout(poll, 5000);
        } else {
          setUpgrading(false);
          if (status.completed) {
            setUpgradeProgress(100);
            setUpgradeStepKey('settings.upgradeProgressFinalizing');
            showToast(t('settings.upgradeComplete'), 'success');
            setShowUpgradeSuccessModal(true);
            setTimeout(() => {
              window.location.reload();
            }, 4500);
          } else if (status.exitCode && status.exitCode !== 0) {
            setError(t('settings.upgradeFailed'));
            setUpgradeProgress(0);
          }
        }
      } catch {
        // If we can't reach the API, the upgrade may be restarting containers
        if (attempts < maxAttempts) {
          setUpgradeStepKey('settings.upgradeProgressRestarting');
          setUpgradeProgress((prev) => Math.max(prev, 94));
          setTimeout(poll, 5000);
        } else {
          setUpgrading(false);
          // Try refreshing to see if the upgrade succeeded
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        }
      }
    };

    setTimeout(poll, 3000); // Wait 3s before first check
  }, [showToast, t]);

  useEffect(() => {
    checkForUpdates();
    fetchSettings();
  }, [checkForUpdates, fetchSettings]);

  // Handle tab change with unsaved changes check
  const handleTabChange = (tabId: TabId) => {
    if (hasUnsavedChanges && activeTab === 'general') {
      if (!window.confirm(t('settings.general.unsavedChanges'))) {
        return;
      }
    }
    setActiveTab(tabId);
    setError('');
  };

  // Render General Tab
  const renderGeneralTab = () => (
    <div className="space-y-6">
      {/* Instance Information Card */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('settings.general.instanceInformation')}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Instance Name */}
          <div>
            <label htmlFor="instanceName" className="label">
              {t('settings.general.instanceName')}
              <span className="text-red-500 ml-1" aria-label="required">
                *
              </span>
            </label>
            <input
              id="instanceName"
              type="text"
              className={`input ${errors.instanceName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              value={formData.instanceName}
              onChange={(e) => handleChange('instanceName', e.target.value)}
              placeholder={t('settings.general.instanceNamePlaceholder')}
              maxLength={100}
              disabled={isLoadingSettings}
            />
            {errors.instanceName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.instanceName}</p>
            )}
          </div>

          {/* Public URL */}
          <div>
            <label htmlFor="publicUrl" className="label">
              {t('settings.general.publicUrl')}
              <span className="text-gray-400 ml-1 text-sm">({t('common.optional')})</span>
            </label>
            <input
              id="publicUrl"
              type="text"
              className={`input ${errors.publicUrl ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              value={formData.publicUrl}
              onChange={(e) => handleChange('publicUrl', e.target.value)}
              placeholder={t('settings.general.publicUrlPlaceholder')}
              disabled={isLoadingSettings}
            />
            {errors.publicUrl && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.publicUrl}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              <Info className="inline h-3 w-3 mr-1" />
              {t('settings.general.publicUrlHelp')}
            </p>
          </div>
        </div>
      </div>

      {/* Instance Details Card */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('settings.general.instanceDetails')}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Timezone */}
          <div ref={timezoneDropdownRef}>
            <label htmlFor="timezone" className="label">
              {t('settings.general.timezone')}
              <span className="text-red-500 ml-1" aria-label="required">
                *
              </span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTimezoneDropdownOpen(!isTimezoneDropdownOpen)}
                className={`input w-full text-left flex items-center justify-between ${errors.timezone ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                disabled={isLoadingSettings}
                aria-expanded={isTimezoneDropdownOpen}
                aria-haspopup="listbox"
              >
                <span>{formData.timezone}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isTimezoneDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isTimezoneDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-white dark:bg-gray-700 shadow-lg border border-gray-200 dark:border-gray-600 max-h-60 overflow-auto">
                  <div className="p-2 sticky top-0 bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <input
                      type="text"
                      placeholder={t('settings.general.timezoneSearch')}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
                      value={timezoneSearch}
                      onChange={(e) => setTimezoneSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ul role="listbox">
                    {filteredTimezones.map((tz: string) => (
                      <li
                        key={tz}
                        role="option"
                        aria-selected={formData.timezone === tz}
                        onClick={() => {
                          handleChange('timezone', tz);
                          setIsTimezoneDropdownOpen(false);
                          setTimezoneSearch('');
                        }}
                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                          formData.timezone === tz
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {tz}
                      </li>
                    ))}
                    {filteredTimezones.length === 0 && (
                      <li className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No timezones found
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            {errors.timezone && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.timezone}</p>
            )}
          </div>

          {/* Public IPv4 */}
          <div>
            <label htmlFor="publicIPv4" className="label">
              {t('settings.general.publicIPv4')}
              <span className="text-gray-400 ml-1 text-sm">({t('common.optional')})</span>
            </label>
            <div className="relative">
              <input
                id="publicIPv4"
                type={showIPv4 ? 'text' : 'password'}
                className={`input w-full pr-10 ${errors.publicIPv4 ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={formData.publicIPv4}
                onChange={(e) => handleChange('publicIPv4', e.target.value)}
                placeholder={t('settings.general.publicIPv4Placeholder')}
                disabled={isLoadingSettings}
              />
              <button
                type="button"
                onClick={() => setShowIPv4(!showIPv4)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label={showIPv4 ? 'Hide IPv4' : 'Show IPv4'}
              >
                {showIPv4 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.publicIPv4 && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.publicIPv4}</p>
            )}
          </div>

          {/* Public IPv6 */}
          <div>
            <label htmlFor="publicIPv6" className="label">
              {t('settings.general.publicIPv6')}
              <span className="text-gray-400 ml-1 text-sm">({t('common.optional')})</span>
            </label>
            <div className="relative">
              <input
                id="publicIPv6"
                type={showIPv6 ? 'text' : 'password'}
                className={`input w-full pr-10 ${errors.publicIPv6 ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={formData.publicIPv6}
                onChange={(e) => handleChange('publicIPv6', e.target.value)}
                placeholder={t('settings.general.publicIPv6Placeholder')}
                disabled={isLoadingSettings}
              />
              <button
                type="button"
                onClick={() => setShowIPv6(!showIPv6)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label={showIPv6 ? 'Hide IPv6' : 'Show IPv6'}
              >
                {showIPv6 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.publicIPv6 && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.publicIPv6}</p>
            )}
          </div>
        </div>
      </div>

      {/* Auto-Update Section */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('settings.autoUpdate')}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('settings.autoUpdateLabel')}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('settings.autoUpdateDescription')}
              </p>
            </div>
            <button
              onClick={() => handleChange('autoUpdate', !formData.autoUpdate)}
              disabled={isLoadingSettings}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                formData.autoUpdate ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
              } ${isLoadingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
              role="switch"
              aria-checked={formData.autoUpdate}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.autoUpdate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {formData.autoUpdate && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {t('settings.autoUpdateActive')}
                </p>
              </div>
            </div>
          )}

          {!formData.autoUpdate && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/50">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('settings.autoUpdateDisabled')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveSettings}
          disabled={!hasUnsavedChanges || isSavingSettings || isLoadingSettings}
          loading={isSavingSettings}
          leftIcon={<Save className="h-4 w-4" />}
        >
          {isSavingSettings ? t('settings.general.saving') : t('settings.general.saveChanges')}
        </Button>
      </div>
    </div>
  );

  // Render Notifications Tab
  const renderNotificationsTab = () => <NotificationsSection />;

  // Render Events Tab
  const renderEventsTab = () => <EventsMatrix />;

  // Render Version & Updates Tab
  const renderVersionTab = () => (
    <div className="space-y-6">
      {/* Version & Updates Section */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('settings.versionAndUpdates')}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Version */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('settings.currentVersion')}
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {versionInfo?.currentVersion || '...'}
              </p>
            </div>
            <button
              onClick={checkForUpdates}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {t('settings.checkForUpdates')}
            </button>
          </div>

          {/* Update Available Banner */}
          {versionInfo?.updateAvailable && !upgrading && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Download className="h-6 w-6 text-blue-500" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-300">
                      {t('settings.updateAvailable')}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      {t('settings.newVersionAvailable', {
                        version: versionInfo.latestVersion,
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpgradeConfirmModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  {t('settings.upgradeNow')}
                </button>
              </div>
            </div>
          )}

          {/* No Update Banner */}
          {versionInfo && !versionInfo.updateAvailable && !upgrading && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-300">
                    {t('settings.upToDate')}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {t('settings.runningLatest')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Upgrade In Progress */}
          {upgrading && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-300">
                    {t('settings.upgradeInProgress')}
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    {t('settings.upgradeInProgressDescription', {
                      version: upgradeStatus?.targetVersion || versionInfo?.latestVersion,
                    })}
                  </p>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="mt-4 space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-yellow-200 dark:bg-yellow-900/40">
                  <div
                    className="h-full rounded-full bg-yellow-500 transition-all duration-700"
                    style={{ width: `${upgradeProgress}%` }}
                  />
                </div>
                <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                  {upgradeProgress}%
                </div>
                <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t(upgradeStepKey)}</span>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-yellow-100 p-3 dark:bg-yellow-900/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    {t('settings.upgradeWarning')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Last Check Time */}
          {versionInfo?.checkedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('settings.lastChecked')} {new Date(versionInfo.checkedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* System Information */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('settings.systemInfo')}
            </h2>
          </div>
        </div>

        <div className="p-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('settings.installedVersion')}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {versionInfo?.currentVersion || '...'}
              </dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('settings.latestVersion')}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {versionInfo?.latestVersion || '...'}
              </dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('settings.autoUpdateStatus')}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {systemSettings?.autoUpdate ? (
                  <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t('settings.enabled')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <XCircle className="h-3.5 w-3.5" />
                    {t('settings.disabled')}
                  </span>
                )}
              </dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('settings.updateSchedule')}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {systemSettings?.autoUpdate
                  ? t('settings.dailyAtMidnight')
                  : t('settings.manualOnly')}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );

  // Render Security Tab
  const renderSecurityTab = () => (
    <div className="space-y-6">
      {/* Change Password Section */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('settings.changePassword')}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="currentPassword" className="label">
              {t('settings.currentPassword')}
            </label>
            <input
              id="currentPassword"
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('settings.currentPassword')}
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="label">
              {t('settings.newPassword')}
            </label>
            <input
              id="newPassword"
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('settings.newPassword')}
            />
          </div>
          <div>
            <label htmlFor="confirmNewPassword" className="label">
              {t('settings.confirmNewPassword')}
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              className="input"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder={t('settings.confirmNewPassword')}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={changePassword}
              disabled={changingPassword}
              className="btn btn-primary"
              type="button"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('settings.changingPassword')}
                </>
              ) : (
                t('settings.saveNewPassword')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('settings.title')}
        </h1>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                group inline-flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium
                ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
                }
              `}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'notifications' && renderNotificationsTab()}
        {activeTab === 'events' && renderEventsTab()}
        {activeTab === 'version' && renderVersionTab()}
        {activeTab === 'security' && renderSecurityTab()}
      </div>

      <Modal
        isOpen={showUpgradeConfirmModal}
        onClose={() => setShowUpgradeConfirmModal(false)}
        title={t('settings.upgradeModalTitle')}
        description={t('settings.upgradeModalDescription')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUpgradeConfirmModal(false)}>
              {t('settings.upgradeCancel')}
            </Button>
            <Button
              variant="primary"
              onClick={triggerUpgrade}
              leftIcon={<ArrowUpCircle className="h-4 w-4" />}
            >
              {t('settings.upgradeConfirmButton')}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/40">
            <span className="font-medium">{t('settings.upgradeModalCurrent')}:</span>{' '}
            {versionInfo?.currentVersion}
          </div>
          <div className="rounded-lg bg-blue-50 p-3 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            <span className="font-medium">{t('settings.upgradeModalTarget')}:</span>{' '}
            {versionInfo?.latestVersion}
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{t('settings.upgradeModalImpact')}</span>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showUpgradeSuccessModal}
        onClose={() => setShowUpgradeSuccessModal(false)}
        title={t('settings.upgradeSuccessTitle')}
        description={t('settings.upgradeSuccessDescription', {
          version: upgradeStatus?.targetVersion || versionInfo?.latestVersion || '',
        })}
        size="md"
        footer={
          <Button variant="primary" onClick={() => window.location.reload()}>
            {t('errors.goHome')}
          </Button>
        }
      >
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          <PartyPopper className="h-5 w-5" />
          <div className="text-sm">
            <p className="font-medium">{t('settings.upgradeSuccessTitle')}</p>
            <p className="text-xs opacity-90">{t('settings.upgradeSuccessReloading')}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
