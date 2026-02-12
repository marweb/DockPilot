import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth';

export default function Setup() {
  const { t } = useTranslation();
  const { setup } = useAuthStore();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('setup.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('setup.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await setup(username, password);
    } catch (err) {
      setError(t('setup.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-primary-600">
            DockPilot
          </h1>
          <h2 className="mt-6 text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('setup.title')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {t('setup.description')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="label">
                {t('setup.username')}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                {t('setup.password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="label">
                {t('setup.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? t('setup.creating') : t('setup.create')}
          </button>
        </form>
      </div>
    </div>
  );
}
