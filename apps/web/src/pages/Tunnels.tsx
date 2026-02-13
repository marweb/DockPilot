import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { RefreshCw, Play, Square, Trash2 } from 'lucide-react';
import api from '../api/client';

type Tunnel = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error' | 'creating';
  publicUrl?: string;
};

export default function Tunnels() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data: tunnels,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['tunnels'],
    queryFn: async () => {
      const response = await api.get('/tunnels');
      return (response.data?.data || []) as Tunnel[];
    },
    refetchInterval: 10000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tunnels/${id}/start`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tunnels'] }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tunnels/${id}/stop`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tunnels'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tunnels/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tunnels'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('tunnels.title')}
        </h1>
        <button onClick={() => refetch()} disabled={isLoading} className="btn btn-secondary btn-sm">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {(tunnels?.length || 0) === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('tunnels.empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('tunnels.name')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('tunnels.status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      URL
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('tunnels.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(tunnels || []).map((tunnel) => (
                    <tr key={tunnel.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {tunnel.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {tunnel.status}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {tunnel.publicUrl || '-'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {tunnel.status !== 'active' ? (
                          <button
                            onClick={() => startMutation.mutate(tunnel.id)}
                            className="btn btn-primary btn-sm"
                            disabled={startMutation.isLoading}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            {t('tunnels.start')}
                          </button>
                        ) : (
                          <button
                            onClick={() => stopMutation.mutate(tunnel.id)}
                            className="btn btn-secondary btn-sm"
                            disabled={stopMutation.isLoading}
                          >
                            <Square className="h-4 w-4 mr-1" />
                            {t('tunnels.stop')}
                          </button>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(tunnel.id)}
                          className="btn btn-danger btn-sm"
                          disabled={deleteMutation.isLoading}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('tunnels.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
