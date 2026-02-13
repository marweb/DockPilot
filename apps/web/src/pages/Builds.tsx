import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { RefreshCw, XCircle } from 'lucide-react';
import api from '../api/client';

type BuildItem = {
  id: string;
  status: 'building' | 'success' | 'error' | 'cancelled';
  startedAt?: string;
  completedAt?: string;
  tags?: string[];
};

export default function Builds() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data: builds,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['builds'],
    queryFn: async () => {
      const response = await api.get('/builds');
      return (response.data?.data || []) as BuildItem[];
    },
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/builds/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['builds'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('builds.title')}</h1>
        <button onClick={() => refetch()} disabled={isLoading} className="btn btn-secondary btn-sm">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {(builds?.length || 0) === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('builds.empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('builds.status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('builds.tags')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('builds.startedAt')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('builds.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(builds || []).map((build) => (
                    <tr key={build.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {build.id.slice(0, 12)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {build.status}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {build.tags?.join(', ') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {build.startedAt ? new Date(build.startedAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {build.status === 'building' && (
                          <button
                            onClick={() => cancelMutation.mutate(build.id)}
                            className="btn btn-danger btn-sm"
                            disabled={cancelMutation.isLoading}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {t('builds.cancel')}
                          </button>
                        )}
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
