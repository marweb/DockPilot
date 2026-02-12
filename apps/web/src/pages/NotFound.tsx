import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Página 404 - Not Found
 * Muestra cuando una ruta no existe
 */
export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-primary-100 dark:bg-primary-900/20 rounded-full">
            <FileQuestion className="h-16 w-16 text-primary-600 dark:text-primary-400" />
          </div>
        </div>

        <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4">404</h1>

        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
          {t('errors.pageNotFound')}
        </h2>

        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {t('errors.pageNotFoundDescription')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Home className="h-5 w-5" />
            {t('errors.goHome')}
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            {t('errors.goBack')}
          </button>
        </div>

        <div className="mt-12 text-sm text-gray-400">
          <p>
            {t('errors.ifProblem')}{' '}
            <Link
              to="/settings"
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              {t('errors.contactSupport')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
