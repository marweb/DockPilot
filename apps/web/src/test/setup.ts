import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'settings.notifications.title': 'Notification Settings',
        'settings.notifications.description':
          'Configure notification channels for alerts and system events',
        'settings.notifications.transactionalEmail': 'Transactional Email',
        'settings.notifications.slack': 'Slack',
        'settings.notifications.telegram': 'Telegram',
        'settings.notifications.discord': 'Discord',
        'settings.notifications.fromName': 'From Name',
        'settings.notifications.fromAddress': 'From Address',
        'settings.notifications.smtpEnabled': 'Enabled',
        'settings.notifications.smtpHost': 'Host',
        'settings.notifications.smtpPort': 'Port',
        'settings.notifications.smtpEncryption': 'Encryption',
        'settings.notifications.smtpTimeout': 'Timeout',
        'settings.notifications.slackWebhookUrl': 'Webhook URL',
        'settings.notifications.telegramBotToken': 'Bot Token',
        'settings.notifications.telegramChatId': 'Chat ID',
        'settings.notifications.discordWebhookUrl': 'Webhook URL',
        'settings.notifications.save': 'Save',
        'settings.notifications.sendTest': 'Send Test',
        'settings.notifications.sendingTest': 'Sending...',
        'settings.events.title': 'Event Notifications',
        'settings.events.description': 'Configure which events trigger notifications',
        'settings.events.loading': 'Loading events...',
        'settings.events.saveSuccess': 'Notification rules updated',
        'settings.events.saveError': 'Failed to update notification rules',
        'settings.events.severity.critical': 'Critical',
        'settings.events.severity.warning': 'Warning',
        'settings.events.severity.info': 'Info',
        'settings.notifications.categories.container': 'Containers',
        'settings.notifications.categories.auth': 'Authentication',
        'settings.notifications.categories.system': 'System',
        'settings.notifications.categories.repo': 'Repositories',
        'settings.notifications.categories.security': 'Security',
        'settings.notifications.errors.loadFailed': 'Failed to load notification settings',
        'settings.notifications.rulesUpdated': 'Notification rules updated',
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
      };

      let result = translations[key] || key.split('.').pop() || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{{${k}}}`, v);
        });
      }
      return result;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
