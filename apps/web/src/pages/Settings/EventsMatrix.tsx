import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Mail,
  MessageSquare,
  Send,
  Bot,
  Webhook,
  Check,
  X,
  AlertTriangle,
  Info,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import apiClient from '../../api/client';

interface NotificationChannel {
  id: string;
  provider: 'smtp' | 'resend' | 'slack' | 'telegram' | 'discord';
  name: string;
  enabled: boolean;
  configured: boolean;
}

interface NotificationEvent {
  eventType: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

interface NotificationRule {
  id?: string;
  eventType: string;
  channelId: string;
  enabled: boolean;
  minSeverity: 'info' | 'warning' | 'critical';
}

interface NotificationEventData {
  category: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

interface MatrixResponse {
  channels: NotificationChannel[];
  events: Record<string, NotificationEventData>;
  matrix: Record<string, NotificationRule[]>;
}

export default function EventsMatrix() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['all']);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const response = await apiClient.get('/notifications/rules/matrix');
      const data = response.data as MatrixResponse;
      setChannels(data.channels);
      setEvents(
        Object.entries(data.events).map(([key, value]) => ({
          eventType: key,
          ...value,
        }))
      );
      // Transformar matriz a array de reglas
      const rulesArray: NotificationRule[] = [];
      Object.entries(data.matrix).forEach(([, eventRules]) => {
        eventRules.forEach((rule: NotificationRule) => {
          rulesArray.push(rule);
        });
      });
      setRules(rulesArray);
    } catch {
      showToast(t('settings.notifications.errors.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(eventType: string, channelId: string) {
    try {
      setSaving(true);
      const existingRule = rules.find(
        (r) => r.eventType === eventType && r.channelId === channelId
      );

      if (existingRule) {
        // Actualizar regla existente
        await apiClient.put(`/notifications/rules/${existingRule.id}`, {
          enabled: !existingRule.enabled,
        });
      } else {
        // Crear nueva regla
        await apiClient.post('/notifications/rules', {
          eventType,
          channelId,
          enabled: true,
          minSeverity: 'info',
        });
      }

      showToast(t('settings.notifications.rulesUpdated'), 'success');
      await loadData();
    } catch {
      showToast(t('settings.notifications.errors.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  function getChannelIcon(provider: string) {
    switch (provider) {
      case 'smtp':
      case 'resend':
        return <Mail className="w-4 h-4" />;
      case 'slack':
        return <MessageSquare className="w-4 h-4" />;
      case 'telegram':
        return <Send className="w-4 h-4" />;
      case 'discord':
        return <Bot className="w-4 h-4" />;
      default:
        return <Webhook className="w-4 h-4" />;
    }
  }

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  }

  function getCategoryColor(category: string) {
    const colors: Record<string, string> = {
      auth: 'bg-blue-100 text-blue-800',
      system: 'bg-purple-100 text-purple-800',
      container: 'bg-green-100 text-green-800',
      repo: 'bg-orange-100 text-orange-800',
      security: 'bg-red-100 text-red-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  }

  const groupedEvents = events.reduce(
    (acc, event) => {
      if (!acc[event.category]) acc[event.category] = [];
      acc[event.category].push(event);
      return acc;
    },
    {} as Record<string, NotificationEvent[]>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('settings.notifications.eventsMatrix.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('settings.notifications.eventsMatrix.description')}
          </p>
        </div>
        <Bell className="w-5 h-5 text-gray-400" />
      </div>

      {/* Channels Legend */}
      <div className="flex flex-wrap gap-2">
        {channels
          .filter((c) => c.configured)
          .map((channel) => (
            <div
              key={channel.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-sm"
            >
              {getChannelIcon(channel.provider)}
              <span className="text-gray-700 dark:text-gray-300">{channel.name}</span>
            </div>
          ))}
      </div>

      {/* Events by Category */}
      <div className="space-y-4">
        {Object.entries(groupedEvents).map(([category, categoryEvents]) => (
          <div
            key={category}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* Category Header */}
            <button
              onClick={() => {
                setExpandedCategories((prev) =>
                  prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
                );
              }}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(category)}`}
                >
                  {t(`settings.notifications.categories.${category}`)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {categoryEvents.length} events
                </span>
              </div>
              {expandedCategories.includes(category) ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {/* Events Table */}
            {expandedCategories.includes(category) && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                        Severity
                      </th>
                      {channels
                        .filter((c) => c.configured)
                        .map((channel) => (
                          <th
                            key={channel.id}
                            className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16"
                          >
                            <div className="flex flex-col items-center gap-1">
                              {getChannelIcon(channel.provider)}
                              <span className="text-[10px]">{channel.provider}</span>
                            </div>
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {categoryEvents.map((event) => (
                      <tr key={event.eventType} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            {getSeverityIcon(event.severity)}
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {t(`settings.notifications.events.${event.eventType}.title`, {
                                  defaultValue: event.eventType,
                                })}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t(`settings.notifications.events.${event.eventType}.description`, {
                                  defaultValue: event.description,
                                })}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              event.severity === 'critical'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : event.severity === 'warning'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}
                          >
                            {event.severity}
                          </span>
                        </td>
                        {channels
                          .filter((c) => c.configured)
                          .map((channel) => {
                            const rule = rules.find(
                              (r) => r.eventType === event.eventType && r.channelId === channel.id
                            );
                            const isEnabled = rule?.enabled ?? false;

                            return (
                              <td key={channel.id} className="px-2 py-3 text-center">
                                <button
                                  onClick={() => toggleRule(event.eventType, channel.id)}
                                  disabled={saving || !channel.enabled}
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                                    isEnabled
                                      ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300 hover:bg-green-200'
                                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 hover:bg-gray-200'
                                  }`}
                                  title={isEnabled ? 'Enabled' : 'Disabled'}
                                >
                                  {isEnabled ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-md flex items-center justify-center">
            <Check className="w-4 h-4 text-green-600 dark:text-green-300" />
          </div>
          <span>{t('settings.notifications.eventsMatrix.enabled')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
            <X className="w-4 h-4 text-gray-400 dark:text-gray-600" />
          </div>
          <span>{t('settings.notifications.eventsMatrix.disabled')}</span>
        </div>
      </div>
    </div>
  );
}
