import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@dockpilot/types';
import api from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setupComplete: boolean | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  checkSetupStatus: () => Promise<void>;
  setup: (username: string, password: string) => Promise<void>;
  refreshTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      setupComplete: null,
      loading: true,

      login: async (username: string, password: string) => {
        const response = await api.post('/auth/login', { username, password });
        const { user, tokens } = response.data.data;
        
        set({
          user,
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // Ignore logout errors
        }
        
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, loading: false });
          return;
        }

        try {
          const response = await api.get('/auth/me');
          set({
            user: response.data.data,
            isAuthenticated: true,
            loading: false,
          });
        } catch {
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
          });
        }
      },

      checkSetupStatus: async () => {
        try {
          const response = await api.get('/auth/setup-status');
          set({ setupComplete: response.data.data.setupComplete });
        } catch {
          set({ setupComplete: false });
        }
      },

      setup: async (username: string, password: string) => {
        const response = await api.post('/auth/setup', { username, password });
        const { user, tokens } = response.data.data;
        
        set({
          user,
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
          setupComplete: true,
        });
      },

      refreshTokens: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await api.post('/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        
        set({
          token: accessToken,
          refreshToken: newRefreshToken,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
