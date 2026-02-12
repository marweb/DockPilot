import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, AlertCircle, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

interface ImagePullProps {
  onClose: () => void;
  onSuccess: () => void;
}

const POPULAR_REGISTRIES = [
  { name: 'Docker Hub', url: 'docker.io' },
  { name: 'GitHub Container Registry', url: 'ghcr.io' },
  { name: 'Google Container Registry', url: 'gcr.io' },
  { name: 'Amazon ECR', url: 'public.ecr.aws' },
  { name: 'Microsoft ACR', url: 'mcr.microsoft.com' },
  { name: 'Red Hat Quay', url: 'quay.io' },
];

const POPULAR_IMAGES = [
  'nginx',
  'redis',
  'postgres',
  'mysql',
  'mongo',
  'node',
  'python',
  'alpine',
  'ubuntu',
  'httpd',
];

interface PullProgress {
  status: string;
  progress?: string;
  id?: string;
}

export default function ImagePull({ onClose, onSuccess }: ImagePullProps) {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [imageName, setImageName] = useState('');
  const [tag, setTag] = useState('latest');
  const [registry, setRegistry] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [progress, setProgress] = useState<PullProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const startPull = () => {
    if (!imageName.trim()) return;

    setIsPulling(true);
    setProgress([]);
    setError(null);
    setSuccess(false);

    const fullImageName = registry ? `${registry}/${imageName}:${tag}` : `${imageName}:${tag}`;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/images/pull`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ token }));
      ws.send(
        JSON.stringify({
          fromImage: fullImageName,
          tag: tag,
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'progress') {
        setProgress((prev) => [...prev, data]);
      } else if (data.type === 'error') {
        setError(data.message);
        setIsPulling(false);
        ws.close();
      } else if (data.type === 'success') {
        setSuccess(true);
        setIsPulling(false);
        ws.close();
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    };

    ws.onerror = () => {
      setError(t('images.pull.error'));
      setIsPulling(false);
    };

    ws.onclose = () => {
      setIsPulling(false);
    };

    return () => {
      ws.close();
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startPull();
  };

  const filteredSuggestions = POPULAR_IMAGES.filter((img) =>
    img.toLowerCase().includes(imageName.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('images.pull.title')}
          </h3>
          <button
            onClick={onClose}
            disabled={isPulling}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Name */}
              <div className="relative">
                <label className="label">{t('images.pull.imageName')}</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={imageName}
                  onChange={(e) => {
                    setImageName(e.target.value);
                    setShowSuggestions(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowSuggestions(imageName.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={t('images.pull.imagePlaceholder')}
                  disabled={isPulling}
                  className="input"
                  autoComplete="off"
                />

                {/* Autocomplete Suggestions */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-auto">
                    {filteredSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setImageName(suggestion);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tag */}
              <div>
                <label className="label">{t('images.pull.tag')}</label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="latest"
                  disabled={isPulling}
                  className="input"
                />
              </div>

              {/* Registry */}
              <div>
                <label className="label">{t('images.pull.registry')}</label>
                <select
                  value={registry}
                  onChange={(e) => setRegistry(e.target.value)}
                  disabled={isPulling}
                  className="input"
                >
                  <option value="">{t('images.pull.defaultRegistry')}</option>
                  {POPULAR_REGISTRIES.map((reg) => (
                    <option key={reg.url} value={reg.url}>
                      {reg.name} ({reg.url})
                    </option>
                  ))}
                </select>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                </div>
              )}

              {/* Progress */}
              {isPulling && progress.length > 0 && (
                <div className="bg-gray-900 rounded-lg p-4 max-h-60 overflow-auto">
                  <div className="space-y-1">
                    {progress.slice(-50).map((p, idx) => (
                      <div key={idx} className="text-sm text-gray-300">
                        {p.id && <span className="text-gray-500">[{p.id}] </span>}
                        {p.status}
                        {p.progress && <span className="text-blue-400 ml-2">{p.progress}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPulling}
                  className="btn btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!imageName.trim() || isPulling}
                  className="btn btn-primary"
                >
                  {isPulling ? (
                    <>
                      <Download className="h-4 w-4 mr-2 animate-bounce" />
                      {t('images.pull.pulling')}
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      {t('images.pull.button')}
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('images.pull.success')}
              </h4>
              <p className="text-gray-500 dark:text-gray-400">{t('images.pull.redirecting')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
