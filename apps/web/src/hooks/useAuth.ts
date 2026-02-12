import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth';
import type { User } from '@dockpilot/types';

/**
 * Authentication hook return type
 */
interface UseAuthReturn {
  /** Current authenticated user or null */
  user: User | null;
  /** JWT access token or null */
  token: string | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is loading */
  loading: boolean;
  /** Whether setup is complete */
  setupComplete: boolean | null;
  /** Login function */
  login: (username: string, password: string) => Promise<void>;
  /** Logout function */
  logout: () => Promise<void>;
  /** Check if user is authenticated */
  checkAuth: () => Promise<void>;
  /** Check setup status */
  checkSetup: () => Promise<void>;
  /** Complete initial setup */
  setup: (username: string, password: string) => Promise<void>;
  /** Whether current user has admin role */
  isAdmin: boolean;
  /** Whether current user has operator role or higher */
  isOperator: boolean;
}

/**
 * Hook for managing authentication state and actions
 * Integrates with Zustand auth store
 *
 * @example
 * ```tsx
 * function LoginButton() {
 *   const { login, loading } = useAuth();
 *
 *   const handleLogin = async () => {
 *     await login('user', 'pass');
 *   };
 *
 *   return <button onClick={handleLogin} disabled={loading}>Login</button>;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [localLoading, setLocalLoading] = useState(false);

  const {
    user,
    token,
    isAuthenticated,
    loading: storeLoading,
    setupComplete,
    login: storeLogin,
    logout: storeLogout,
    checkAuth: storeCheckAuth,
    checkSetupStatus,
    setup: storeSetup,
  } = useAuthStore();

  /**
   * Login with username and password
   */
  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      setLocalLoading(true);
      try {
        await storeLogin(username, password);
      } finally {
        setLocalLoading(false);
      }
    },
    [storeLogin]
  );

  /**
   * Logout current user
   */
  const logout = useCallback(async (): Promise<void> => {
    setLocalLoading(true);
    try {
      await storeLogout();
    } finally {
      setLocalLoading(false);
    }
  }, [storeLogout]);

  /**
   * Check authentication status
   */
  const checkAuth = useCallback(async (): Promise<void> => {
    await storeCheckAuth();
  }, [storeCheckAuth]);

  /**
   * Check setup status
   */
  const checkSetup = useCallback(async (): Promise<void> => {
    await checkSetupStatus();
  }, [checkSetupStatus]);

  /**
   * Complete initial setup
   */
  const setup = useCallback(
    async (username: string, password: string): Promise<void> => {
      setLocalLoading(true);
      try {
        await storeSetup(username, password);
      } finally {
        setLocalLoading(false);
      }
    },
    [storeSetup]
  );

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Determine user roles
  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'admin' || user?.role === 'operator';

  return {
    user,
    token,
    isAuthenticated,
    loading: storeLoading || localLoading,
    setupComplete,
    login,
    logout,
    checkAuth,
    checkSetup,
    setup,
    isAdmin,
    isOperator,
  };
}

export default useAuth;
