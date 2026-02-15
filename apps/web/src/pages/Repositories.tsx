import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { CheckCircle2, Copy, GitBranch, KeyRound, Play, RefreshCw, Shield } from 'lucide-react';
import api from '../api/client';

type Repository = {
  id: string;
  name: string;
  provider: 'github' | 'gitlab' | 'generic';
  repoUrl: string;
  branch: string;
  composePath: string;
  visibility: 'public' | 'private';
  authType: 'none' | 'ssh' | 'https_token';
  autoDeploy: boolean;
  hasHttpsToken: boolean;
};

export default function Repositories() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    provider: 'generic',
    repoUrl: '',
    branch: 'main',
    composePath: 'docker-compose.yml',
    visibility: 'public',
    authType: 'none',
    httpsToken: '',
    autoDeploy: false,
  });
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [stackName, setStackName] = useState('');
  const [message, setMessage] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [githubDevice, setGithubDevice] = useState<null | {
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval?: number;
  }>(null);
  const [gitlabDevice, setGitlabDevice] = useState<null | {
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval?: number;
  }>(null);

  const { data: repos, isLoading } = useQuery({
    queryKey: ['repos'],
    queryFn: async () => {
      const response = await api.get('/repos');
      return (response.data?.data || []) as Repository[];
    },
  });

  const { data: oauthStatus } = useQuery({
    queryKey: ['repos-oauth-status'],
    queryFn: async () => {
      const response = await api.get('/repos/oauth/status');
      return response.data?.data as {
        hasPublicUrl: boolean;
        githubAppConfigured: boolean;
        gitlabOAuthConfigured: boolean;
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      setMessage('');
      const response = await api.post('/repos', {
        ...form,
        httpsToken: form.authType === 'https_token' ? form.httpsToken : undefined,
      });
      return response.data?.data as Repository;
    },
    onSuccess: () => {
      setMessage('Repositorio creado correctamente');
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
    onError: (error: unknown) => {
      setMessage((error as { message?: string })?.message || 'Error al crear repositorio');
    },
  });

  const testMutation = useMutation({
    mutationFn: async (repoId: string) => {
      const response = await api.post(`/repos/${repoId}/test-connection`);
      return response.data;
    },
    onSuccess: () => setMessage('Conexión validada correctamente'),
    onError: (error: unknown) => {
      setMessage((error as { message?: string })?.message || 'Error al validar conexión');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (repoId: string) => {
      const response = await api.post(`/repos/${repoId}/sync`);
      return response.data;
    },
    onSuccess: () => setMessage('Repositorio sincronizado'),
    onError: (error: unknown) => {
      setMessage((error as { message?: string })?.message || 'Error al sincronizar repositorio');
    },
  });

  const deployMutation = useMutation({
    mutationFn: async (repoId: string) => {
      const response = await api.post(`/repos/${repoId}/deploy`, {
        stackName: stackName || undefined,
      });
      return response.data;
    },
    onSuccess: (data: { message?: string }) => {
      setMessage(data?.message || 'Deploy completado');
    },
    onError: (error: unknown) => {
      setMessage((error as { message?: string })?.message || 'Error al desplegar');
    },
  });

  const loadPublicKeyMutation = useMutation({
    mutationFn: async (repoId: string) => {
      const response = await api.get(`/repos/${repoId}/public-key`);
      return response.data?.data?.publicKey as string;
    },
    onSuccess: (key) => {
      setPublicKey(key);
      setMessage('Clave pública generada');
    },
    onError: (error: unknown) => {
      setMessage((error as { message?: string })?.message || 'Error al obtener clave SSH');
    },
  });

  const githubStartMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/repos/oauth/github/device/start');
      return response.data?.data as {
        device_code: string;
        user_code: string;
        verification_uri: string;
        interval?: number;
      };
    },
    onSuccess: (data) => {
      setGithubDevice(data);
      setMessage('Flujo GitHub iniciado. Completa el código en la URL indicada.');
      queryClient.invalidateQueries({ queryKey: ['repos-oauth-status'] });
    },
    onError: (error: unknown) => {
      setMessage(
        (error as { message?: string })?.message || 'No se pudo iniciar GitHub device flow'
      );
    },
  });

  const githubPollMutation = useMutation({
    mutationFn: async () => {
      if (!githubDevice) throw new Error('GitHub device flow no iniciado');
      const response = await api.post('/repos/oauth/github/device/poll', {
        deviceCode: githubDevice.device_code,
      });
      return response.data?.data as {
        pending?: boolean;
        error?: string;
        connection?: { username: string };
      };
    },
    onSuccess: (data) => {
      if (data.pending) {
        setMessage(`GitHub pendiente: ${data.error || 'authorization_pending'}`);
        return;
      }
      setMessage(`GitHub conectado: ${data.connection?.username || 'ok'}`);
      setGithubDevice(null);
    },
    onError: (error: unknown) => {
      setMessage((error as { message?: string })?.message || 'Error al validar GitHub device flow');
    },
  });

  const gitlabStartMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/repos/oauth/gitlab/device/start');
      return response.data?.data as {
        device_code: string;
        user_code: string;
        verification_uri: string;
        interval?: number;
      };
    },
    onSuccess: (data) => {
      setGitlabDevice(data);
      setMessage('Flujo GitLab iniciado. Completa el código en la URL indicada.');
      queryClient.invalidateQueries({ queryKey: ['repos-oauth-status'] });
    },
    onError: (error: unknown) => {
      setMessage(
        (error as { message?: string })?.message || 'No se pudo iniciar GitLab device flow'
      );
    },
  });

  const gitlabPollMutation = useMutation({
    mutationFn: async () => {
      if (!gitlabDevice) throw new Error('GitLab device flow no iniciado');
      const response = await api.post('/repos/oauth/gitlab/device/poll', {
        deviceCode: gitlabDevice.device_code,
      });
      return response.data?.data as {
        pending?: boolean;
        error?: string;
        connection?: { username: string };
      };
    },
    onSuccess: (data) => {
      if (data.pending) {
        setMessage(`GitLab pendiente: ${data.error || 'authorization_pending'}`);
        return;
      }
      setMessage(`GitLab conectado: ${data.connection?.username || 'ok'}`);
      setGitlabDevice(null);
    },
    onError: (error: unknown) => {
      setMessage((error as { message?: string })?.message || 'Error al validar GitLab device flow');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Repositorios</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Deploy desde repositorios manuales (públicos o privados). OAuth es opcional.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            Integraciones OAuth (opcional)
          </h2>
        </div>
        <div className="card-body text-sm text-gray-600 dark:text-gray-300 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary-600" />
            URL pública disponible: {oauthStatus?.hasPublicUrl ? 'Sí' : 'No'}
          </div>
          <div>GitHub App configurada: {oauthStatus?.githubAppConfigured ? 'Sí' : 'No'}</div>
          <div>GitLab OAuth configurada: {oauthStatus?.gitlabOAuthConfigured ? 'Sí' : 'No'}</div>
          {!oauthStatus?.hasPublicUrl && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-amber-700 dark:text-amber-300">
              Sin URL pública, usa flujo manual (SSH o token HTTPS). OAuth/webhooks quedan
              desactivados.
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => githubStartMutation.mutate()}
              disabled={!oauthStatus?.githubAppConfigured || githubStartMutation.isLoading}
            >
              Conectar GitHub (Device Flow)
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => gitlabStartMutation.mutate()}
              disabled={!oauthStatus?.gitlabOAuthConfigured || gitlabStartMutation.isLoading}
            >
              Conectar GitLab (Device Flow)
            </button>
          </div>

          {githubDevice && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mt-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                GitHub Device Flow
              </p>
              <p className="text-xs mt-1">Abre: {githubDevice.verification_uri}</p>
              <p className="text-xs">Código: {githubDevice.user_code}</p>
              <button
                className="btn btn-secondary btn-sm mt-2"
                onClick={() => githubPollMutation.mutate()}
              >
                Verificar GitHub
              </button>
            </div>
          )}

          {gitlabDevice && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mt-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                GitLab Device Flow
              </p>
              <p className="text-xs mt-1">Abre: {gitlabDevice.verification_uri}</p>
              <p className="text-xs">Código: {gitlabDevice.user_code}</p>
              <button
                className="btn btn-secondary btn-sm mt-2"
                onClick={() => gitlabPollMutation.mutate()}
              >
                Verificar GitLab
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Nuevo repositorio</h2>
        </div>
        <div className="card-body space-y-3">
          {message && (
            <div className="text-sm text-primary-700 dark:text-primary-300">{message}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Nombre"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <select
              className="input"
              value={form.provider}
              onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}
            >
              <option value="generic">Genérico</option>
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
            </select>
            <input
              className="input md:col-span-2"
              placeholder="URL repositorio"
              value={form.repoUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, repoUrl: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Branch (main)"
              value={form.branch}
              onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Ruta compose (docker-compose.yml)"
              value={form.composePath}
              onChange={(e) => setForm((prev) => ({ ...prev, composePath: e.target.value }))}
            />
            <select
              className="input"
              value={form.visibility}
              onChange={(e) => setForm((prev) => ({ ...prev, visibility: e.target.value }))}
            >
              <option value="public">Público</option>
              <option value="private">Privado</option>
            </select>
            <select
              className="input"
              value={form.authType}
              onChange={(e) => setForm((prev) => ({ ...prev, authType: e.target.value }))}
            >
              <option value="none">Sin auth (público)</option>
              <option value="ssh">SSH key</option>
              <option value="https_token">HTTPS token</option>
            </select>
            {form.authType === 'https_token' && (
              <input
                className="input md:col-span-2"
                placeholder="Token HTTPS"
                type="password"
                value={form.httpsToken}
                onChange={(e) => setForm((prev) => ({ ...prev, httpsToken: e.target.value }))}
              />
            )}
            <label className="text-sm text-gray-700 dark:text-gray-300 inline-flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.autoDeploy}
                onChange={(e) => setForm((prev) => ({ ...prev, autoDeploy: e.target.checked }))}
              />
              Autodeploy (requiere webhook y endpoint público verificable)
            </label>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isLoading}
          >
            Crear repositorio
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            Repositorios registrados
          </h2>
        </div>
        <div className="card-body p-0">
          {(repos?.length || 0) === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
              {isLoading ? 'Cargando...' : 'No hay repositorios registrados'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Repo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Auth
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(repos || []).map((repo) => (
                    <tr key={repo.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {repo.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 break-all">
                        {repo.repoUrl}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1">
                          <GitBranch className="h-3.5 w-3.5" />
                          {repo.branch}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {repo.authType}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => testMutation.mutate(repo.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Probar
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => syncMutation.mutate(repo.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Sync
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedRepo(repo.id);
                            deployMutation.mutate(repo.id);
                          }}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Deploy
                        </button>
                        {repo.authType === 'ssh' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => loadPublicKeyMutation.mutate(repo.id)}
                          >
                            <KeyRound className="h-4 w-4 mr-1" />
                            Clave SSH
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

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Deploy rápido</h2>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            className="input"
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
          >
            <option value="">Seleccionar repositorio</option>
            {(repos || []).map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Nombre de stack (opcional)"
            value={stackName}
            onChange={(e) => setStackName(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!selectedRepo || deployMutation.isLoading}
            onClick={() => deployMutation.mutate(selectedRepo)}
          >
            Deploy desde repo
          </button>
        </div>
      </div>

      {publicKey && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Clave pública SSH</h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(publicKey);
                setMessage('Clave copiada al portapapeles');
              }}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar
            </button>
          </div>
          <div className="card-body">
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-auto">
              {publicKey}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
