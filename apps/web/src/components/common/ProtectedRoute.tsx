import { useEffect, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Componente HOC para rutas protegidas
 * - Verifica autenticación
 * - Verifica estado de setup
 * - Redirecciona a login si no autenticado
 * - Redirecciona a setup si no configurado
 * - Preserva la ubicación para redirección post-login
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, setupComplete, loading, checkAuth, checkSetupStatus } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // Verificar estado de autenticación al montar
    if (loading) {
      checkSetupStatus();
      checkAuth();
    }
  }, [checkAuth, checkSetupStatus, loading]);

  // Mostrar loading mientras verifica
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Si no hay setup, redirigir a setup
  if (setupComplete === false) {
    return <Navigate to="/setup" replace />;
  }

  // Si no está autenticado, redirigir a login con la ubicación actual
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Usuario autenticado y setup completo
  return <>{children}</>;
}
