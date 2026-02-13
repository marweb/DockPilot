import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { RefreshCw, Square, Trash2 } from 'lucide-react';
import api from '../api/client';

type ComposeStack = {
  name: string;
  status: 'running' | 'stopped' | 'partial';
  services: Array<{ name: string; status: string }>;
};

export default function Compose() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data: stacks,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['compose-stacks'],
    queryFn: async () => {
      const response = await api.get('/compose/stacks');
      return (response.data?.data || []) as ComposeStack[];
    },
    refetchInterval: 10000,
  });

  const downMutation = useMutation({
    mutationFn: (name: string) => api.post('/compose/down', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compose-stacks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/compose/${name}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compose-stacks'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('compose.title')}
        </h1>
        <button onClick={() => refetch()} disabled={isLoading} className="btn btn-secondary btn-sm">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {(stacks?.length || 0) === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('compose.empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('compose.name')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('compose.status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('compose.services')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('compose.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(stacks || []).map((stack) => (
                    <tr key={stack.name} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {stack.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {stack.status}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {stack.services.length}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => downMutation.mutate(stack.name)}
                          className="btn btn-secondary btn-sm"
                          disabled={downMutation.isLoading}
                        >
                          <Square className="h-4 w-4 mr-1" />
                          {t('compose.stop')}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(stack.name)}
                          className="btn btn-danger btn-sm"
                          disabled={deleteMutation.isLoading}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('compose.delete')}
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
