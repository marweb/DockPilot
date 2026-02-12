import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Network } from '@dockpilot/types';
import { Network as NetworkIcon, Trash2, Eye, Copy, Check, Link as LinkIcon } from 'lucide-react';

interface NetworkListProps {
  networks: Network[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onSelect: (network: Network) => void;
  isDeleting: boolean;
}

export default function NetworkList({
  networks,
  isLoading,
  onDelete,
  onSelect,
  isDeleting,
}: NetworkListProps) {
  const { t } = useTranslation();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingNetwork, setDeletingNetwork] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (network: Network) => {
    const containerCount = network.containers ? Object.keys(network.containers).length : 0;
    if (containerCount > 0) {
      if (
        !window.confirm(
          t('networks.deleteInUseConfirm', { name: network.name, count: containerCount })
        )
      ) {
        return;
      }
    }
    setDeletingNetwork(network.id);
    onDelete(network.id);
    setTimeout(() => setDeletingNetwork(null), 1000);
  };

  const getDriverBadge = (driver: string) => {
    const colors: Record<string, string> = {
      bridge: 'badge-info',
      host: 'badge-success',
      none: 'badge-neutral',
      overlay: 'badge-warning',
      macvlan: 'badge-info',
    };
    return colors[driver] || 'badge-neutral';
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (networks.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-center py-12">
            <NetworkIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
              {t('networks.empty.title')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">{t('networks.empty.description')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block card overflow-hidden">
        <div className="table-container">
          <table className="min-w-full">
            <thead>
              <tr>
                <th>{t('networks.list.name')}</th>
                <th>{t('networks.list.id')}</th>
                <th>{t('networks.list.driver')}</th>
                <th>{t('networks.list.scope')}</th>
                <th>{t('networks.list.subnet')}</th>
                <th>{t('networks.list.containers')}</th>
                <th className="text-right">{t('networks.list.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((network) => (
                <tr key={network.id}>
                  <td className="font-medium">
                    <div className="flex items-center gap-2">
                      <NetworkIcon className="h-4 w-4 text-purple-500" />
                      {network.name}
                    </div>
                  </td>
                  <td className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      {network.id.substring(0, 12)}
                      <button
                        onClick={() => copyToClipboard(network.id, network.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {copiedId === network.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getDriverBadge(network.driver)} text-xs`}>
                      {network.driver}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${network.scope === 'local' ? 'badge-success' : 'badge-info'} text-xs`}
                    >
                      {network.scope}
                    </span>
                  </td>
                  <td className="text-sm text-gray-600 dark:text-gray-400">
                    {network.ipam?.config?.[0]?.subnet || '-'}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" />
                      <span
                        className={
                          network.containers && Object.keys(network.containers).length > 0
                            ? 'text-blue-600'
                            : 'text-gray-400'
                        }
                      >
                        {network.containers ? Object.keys(network.containers).length : 0}
                      </span>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onSelect(network)}
                        className="btn btn-ghost btn-icon btn-sm"
                        title={t('networks.actions.view')}
                      >
                        <Eye className="h-4 w-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(network)}
                        disabled={isDeleting || deletingNetwork === network.id}
                        className="btn btn-ghost btn-icon btn-sm"
                        title={t('networks.actions.remove')}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {networks.map((network) => (
          <div key={network.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <NetworkIcon className="h-5 w-5 text-purple-500" />
                <span className="font-medium text-gray-900 dark:text-gray-100">{network.name}</span>
              </div>
              <span className={`badge ${getDriverBadge(network.driver)} text-xs`}>
                {network.driver}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {network.id.substring(0, 12)}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
              <div>
                <span
                  className={`badge ${network.scope === 'local' ? 'badge-success' : 'badge-info'} text-xs`}
                >
                  {network.scope}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <LinkIcon className="h-3 w-3" />
                {network.containers ? Object.keys(network.containers).length : 0} containers
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              {network.ipam?.config?.[0]?.subnet || t('networks.noSubnet')}
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => onSelect(network)} className="flex-1 btn btn-secondary btn-sm">
                <Eye className="h-3 w-3 mr-1" />
                {t('common.view')}
              </button>
              <button
                onClick={() => handleDelete(network)}
                disabled={isDeleting || deletingNetwork === network.id}
                className="btn btn-danger btn-sm"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
