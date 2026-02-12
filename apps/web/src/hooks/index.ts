/**
 * Custom Hooks exports
 * Centralized exports for all custom React hooks
 */

// Authentication hook
export { useAuth, default } from './useAuth';

// Theme hook
export { useTheme } from './useTheme';

// Locale/Internationalization hook
export { useLocale, AVAILABLE_LANGUAGES } from './useLocale';
export type { Locale, Language } from './useLocale';

// WebSocket hook
export { useWebSocket } from './useWebSocket';
export type {
  WebSocketStatus,
  WebSocketMessageHandler,
  UseWebSocketOptions,
  UseWebSocketReturn,
} from './useWebSocket';

// Pagination hook
export { usePagination } from './usePagination';
export type { UsePaginationOptions, UsePaginationReturn } from './usePagination';
