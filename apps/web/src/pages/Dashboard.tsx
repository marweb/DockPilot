import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Activity, Cpu, MemoryStick } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';
import StatsOverview from '../components/dashboard/StatsOverview';
import ResourceChart from '../components/dashboard/ResourceChart';
import ActivityFeed from '../components/dashboard/ActivityFeed';

interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

function mapAuditToActivity(log: AuditLog) {
  const actionMap: Record<string, string> = {
    'container.start': 'container_start',
    'container.stop': 'container_stop',
    'container.restart': 'container_restart',
    'container.delete': 'container_delete',
    'image.pull': 'image_pull',
    'image.delete': 'image_delete',
    'volume.create': 'volume_create',
    'volume.delete': 'volume_delete',
    'network.create': 'network_create',
    'network.delete': 'network_delete',
    'build.start': 'build_start',
    'build.success': 'build_success',
    'build.fail': 'build_fail',
  };

  const type = actionMap[log.action] || 'system_info';

  return {
    id: log.id,
    type: type as
      | 'container_start'
      | 'container_stop'
      | 'container_restart'
      | 'container_delete'
      | 'image_pull'
      | 'image_delete'
      | 'volume_create'
      | 'volume_delete'
      | 'network_create'
      | 'network_delete'
      | 'build_start'
      | 'build_success'
      | 'build_fail'
      | 'system_warning'
      | 'system_info',
    message: log.action.replace(/\./g, ' '),
    details: log.resourceId ? `${log.resource}: ${log.resourceId}` : log.resource,
    timestamp: new Date(log.timestamp).getTime(),
    user: log.username,
    target: log.resourceId,
  };
}

export default function Dashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const { data: dockerInfo } = useQuery({
    queryKey: ['docker-info'],
    queryFn: () => api.get('/info').then((res) => res.data.data),
  });

  const { data: containers } = useQuery({
    queryKey: ['containers'],
    queryFn: () => api.get('/containers').then((res) => res.data.data),
  });

  const { data: images } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data.data),
  });

  const { data: volumes } = useQuery({
    queryKey: ['volumes'],
    queryFn: () => api.get('/volumes').then((res) => res.data.data),
  });

  const { data: networks } = useQuery({
    queryKey: ['networks'],
    queryFn: () => api.get('/networks').then((res) => res.data.data),
  });

  const { data: builds } = useQuery({
    queryKey: ['builds'],
    queryFn: () => api.get('/builds').then((res) => res.data.data),
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () =>
      api.get('/audit/logs', { params: { limit: 20 } }).then((res) => res.data.data as AuditLog[]),
    retry: false,
  });

  const { data: resourceStats, isLoading: resourceLoading } = useQuery({
    queryKey: ['dashboard-resource-stats'],
    queryFn: async () => {
      const running =
        containers?.filter((c: { status: string }) => c.status === 'running').slice(0, 5) || [];

      if (running.length === 0) {
        return [];
      }

      const stats = await Promise.all(
        running.map(async (container: { id: string }) => {
          const response = await api.get(`/containers/${container.id}/stats`);
          const data = response.data.data;
          return {
            timestamp: Date.now(),
            cpu: data?.cpuPercent ?? 0,
            memory: data?.memoryPercent ?? 0,
            disk: 0,
            networkRx: data?.networkRx ?? 0,
            networkTx: data?.networkTx ?? 0,
          };
        })
      );

      return stats;
    },
    enabled: Boolean(containers?.length),
    refetchInterval: 5000,
  });

  const runningContainers =
    containers?.filter((c: { status: string }) => c.status === 'running').length || 0;
  const stoppedContainers = (containers?.length || 0) - runningContainers;
  const totalImages = images?.length || 0;
  const totalVolumes = volumes?.length || 0;
  const totalNetworks = networks?.length || 0;

  const buildStats = useMemo(() => {
    const list = builds || [];
    return {
      success: list.filter((b: { status: string }) => b.status === 'success').length,
      failed: list.filter((b: { status: string }) => b.status === 'failed').length,
      pending: list.filter((b: { status: string }) =>
        ['running', 'pending', 'building'].includes(b.status)
      ).length,
    };
  }, [builds]);

  const activities = useMemo(
    () => (auditLogs || []).map(mapAuditToActivity),
    [auditLogs]
  );

  const pruneMutation = useMutation({
    mutationFn: async () => {
      const [containersResult, imagesResult, volumesResult, networksResult] = await Promise.all([
        api.post('/containers/prune'),
        api.post('/images/prune'),
        api.post('/volumes/prune'),
        api.post('/networks/prune'),
      ]);

      return {
        containersDeleted: containersResult.data?.data?.containersDeleted?.length || 0,
        imagesDeleted: imagesResult.data?.data?.imagesDeleted?.length || 0,
        volumesDeleted: volumesResult.data?.data?.volumesDeleted?.length || 0,
        networksDeleted: networksResult.data?.data?.networksDeleted?.length || 0,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['volumes'] });
      queryClient.invalidateQueries({ queryKey: ['networks'] });

      const total =
        result.containersDeleted +
        result.imagesDeleted +
        result.volumesDeleted +
        result.networksDeleted;

      showToast(t('dashboard.pruneSuccess', { total }), 'success');
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || t('dashboard.pruneError');
      showToast(message, 'error');
    },
  });

  const handlePruneSystem = () => {
    const confirmed = window.confirm(
      `${t('dashboard.prune')}\n\n${t('dashboard.pruneConfirmBody')}`
    );

    if (!confirmed) {
      return;
    }

    pruneMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {t('dashboard.title')}
      </h1>

      <StatsOverview
        containers={{
          running: runningContainers,
          stopped: stoppedContainers,
          total: containers?.length || 0,
        }}
        images={{
          total: totalImages,
          totalSize: '-',
        }}
        volumes={{
          count: totalVolumes,
          usedSpace: '-',
        }}
        networks={{
          count: totalNetworks,
        }}
        builds={buildStats}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ResourceChart
          data={resourceStats}
          isLoading={resourceLoading}
          isRealTime={Boolean(resourceStats?.length)}
        />
        <ActivityFeed activities={activities} isLoading={auditLoading} />
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('dashboard.systemInfo')}
          </h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.cpus')}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {dockerInfo?.cpus || '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MemoryStick className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.memory')}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {dockerInfo?.memoryLimit ? t('dashboard.enabled') : t('dashboard.disabled')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.os')}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {dockerInfo?.operatingSystem || '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.version')}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {dockerInfo?.serverVersion || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('dashboard.quickActions')}
          </h2>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => navigate('/images?action=pull')}>
              {t('dashboard.pullImage')}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/compose')}>
              {t('dashboard.createContainer')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handlePruneSystem}
              disabled={pruneMutation.isPending}
            >
              {t('dashboard.prune')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
