import { RouterProvider } from 'react-router-dom';
import router from './router';
import {
  AuthProvider,
  ThemeProvider,
  LocaleProvider,
  QueryProvider,
  ToastProvider,
  ErrorProvider,
  ErrorBoundary,
} from './contexts';
import './index.css';

/**
 * Componente principal de la aplicación DockPilot
 * Integra todos los providers y contexts necesarios
 *
 * Estructura de providers (de adentro hacia afuera):
 * 1. ErrorProvider - Manejo de errores global
 * 2. ErrorBoundary - Captura errores de React
 * 3. QueryProvider - React Query para data fetching
 * 4. ThemeProvider - Tema claro/oscuro/sistema
 * 5. LocaleProvider - Internacionalización (i18n)
 * 6. ToastProvider - Notificaciones toast
 * 7. AuthProvider - Estado de autenticación
 * 8. RouterProvider - React Router 6
 */
function App() {
  return (
    <ErrorProvider>
      <ErrorBoundary>
        <QueryProvider>
          <ThemeProvider>
            <LocaleProvider>
              <ToastProvider>
                <AuthProvider>
                  <RouterProvider
                    router={router}
                    fallbackElement={
                      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                      </div>
                    }
                  />
                </AuthProvider>
              </ToastProvider>
            </LocaleProvider>
          </ThemeProvider>
        </QueryProvider>
      </ErrorBoundary>
    </ErrorProvider>
  );
}

export default App;
