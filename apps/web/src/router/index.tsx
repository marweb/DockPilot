import { Suspense, lazy } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// Lazy loading de páginas
const Login = lazy(() => import('../pages/Login'));
const Setup = lazy(() => import('../pages/Setup'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Containers = lazy(() => import('../pages/Containers'));
const ContainerDetail = lazy(() => import('../pages/ContainerDetail'));
const Images = lazy(() => import('../pages/Images'));
const Volumes = lazy(() => import('../pages/Volumes'));
const Networks = lazy(() => import('../pages/Networks'));
const Builds = lazy(() => import('../pages/Builds'));
const Compose = lazy(() => import('../pages/Compose'));
const Tunnels = lazy(() => import('../pages/Tunnels'));
const Settings = lazy(() => import('../pages/Settings'));
const Documentation = lazy(() => import('../pages/Documentation'));
const Support = lazy(() => import('../pages/Support'));
const NotFound = lazy(() => import('../pages/NotFound'));

// Componente de carga
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

// Wrapper para lazy loading
const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

// Layout wrapper con Outlet
const LayoutWrapper = () => (
  <Layout>
    <Outlet />
  </Layout>
);

/**
 * Configuración completa de React Router 6
 * - Lazy loading de páginas
 * - Rutas protegidas con autenticación
 * - Layouts anidados
 * - Manejo de 404
 */
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  // Rutas públicas (sin autenticación)
  {
    path: '/login',
    element: (
      <LazyWrapper>
        <Login />
      </LazyWrapper>
    ),
  },
  {
    path: '/setup',
    element: (
      <LazyWrapper>
        <Setup />
      </LazyWrapper>
    ),
  },

  // Rutas protegidas (requieren autenticación)
  {
    element: (
      <LazyWrapper>
        <ProtectedRoute>
          <LayoutWrapper />
        </ProtectedRoute>
      </LazyWrapper>
    ),
    children: [
      {
        path: '/',
        element: <Dashboard />,
      },
      {
        path: '/containers',
        element: <Containers />,
      },
      {
        path: '/containers/:id',
        element: <ContainerDetail />,
      },
      {
        path: '/images',
        element: <Images />,
      },
      {
        path: '/volumes',
        element: <Volumes />,
      },
      {
        path: '/networks',
        element: <Networks />,
      },
      {
        path: '/builds',
        element: <Builds />,
      },
      {
        path: '/compose',
        element: <Compose />,
      },
      {
        path: '/tunnels',
        element: <Tunnels />,
      },
      {
        path: '/settings',
        element: <Settings />,
      },
      {
        path: '/documentation',
        element: <Documentation />,
      },
      {
        path: '/support',
        element: <Support />,
      },
    ],
  },

  // Ruta 404
  {
    path: '*',
    element: (
      <LazyWrapper>
        <NotFound />
      </LazyWrapper>
    ),
  },
]);

export default router;
