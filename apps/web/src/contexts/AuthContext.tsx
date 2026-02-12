import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import type { User, UserRole } from '@dockpilot/types';

/**
 * Auth context value type
 */
interface AuthContextValue {
  /** Current authenticated user or null */
  user: User | null;
  /** JWT access token or null */
  token: string | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is loading */
  loading: boolean;
  /** Whether initial setup is complete */
  setupComplete: boolean | null;
  /** Login with username and password */
  login: (username: string, password: string) => Promise<void>;
  /** Logout current user */
  logout: () => Promise<void>;
  /** Check authentication status */
  checkAuth: () => Promise<void>;
  /** Check setup status */
  checkSetup: () => Promise<void>;
  /** Complete initial setup */
  setup: (username: string, password: string) => Promise<void>;
  /** Check if user has specific role */
  hasRole: (role: UserRole) => boolean;
  /** Check if user has admin role */
  isAdmin: boolean;
  /** Check if user has operator role or higher */
  isOperator: boolean;
  /** Check if user has viewer role or higher */
  isViewer: boolean;
}

/**
 * Auth context
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth provider props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider component
 * Provides authentication state and methods to the application
 * Integrates with Zustand auth store
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <Router>
 *         <Routes />
 *       </Router>
 *     </AuthProvider>
 *   );
 * }
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const store = useAuthStore();

  /**
   * Check auth on mount
   */
  useEffect(() => {
    store.checkAuth();
  }, []);

  /**
   * Check if user has specific role
   */
  const hasRole = (role: UserRole): boolean => {
    if (!store.user) return false;

    const roleHierarchy: Record<UserRole, number> = {
      admin: 3,
      operator: 2,
      viewer: 1,
    };

    const userRoleLevel = roleHierarchy[store.user.role];
    const requiredRoleLevel = roleHierarchy[role];

    return userRoleLevel >= requiredRoleLevel;
  };

  /**
   * Role checks
   */
  const isAdmin = store.user?.role === 'admin';
  const isOperator = store.user?.role === 'admin' || store.user?.role === 'operator';
  const isViewer = !!store.user;

  const value: AuthContextValue = {
    user: store.user,
    token: store.token,
    isAuthenticated: store.isAuthenticated,
    loading: store.loading,
    setupComplete: store.setupComplete,
    login: store.login,
    logout: store.logout,
    checkAuth: store.checkAuth,
    checkSetup: store.checkSetupStatus,
    setup: store.setup,
    hasRole,
    isAdmin,
    isOperator,
    isViewer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 * Must be used within AuthProvider
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { user, isAuthenticated } = useAuthContext();
 *
 *   if (!isAuthenticated) return <LoginPrompt />;
 *
 *   return <div>Welcome, {user?.username}!</div>;
 * }
 * ```
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

export default AuthContext;
