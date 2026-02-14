import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/auth';

/**
 * WebSocket connection status
 */
export type WebSocketStatus = 'connecting' | 'open' | 'closing' | 'closed' | 'error';

/**
 * WebSocket message handler type
 */
export type WebSocketMessageHandler<T = unknown> = (data: T) => void;

/**
 * WebSocket options
 */
export interface UseWebSocketOptions<T = unknown> {
  /** URL path (without base URL) */
  path: string;
  /** Message handler callback */
  onMessage?: WebSocketMessageHandler<T>;
  /** Connection open handler */
  onOpen?: () => void;
  /** Connection close handler */
  onClose?: (event: CloseEvent) => void;
  /** Error handler */
  onError?: (error: Event) => void;
  /** Whether to connect automatically */
  autoConnect?: boolean;
  /** Reconnect on disconnect */
  reconnect?: boolean;
  /** Reconnect interval in ms */
  reconnectInterval?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
}

/**
 * WebSocket hook return type
 */
export interface UseWebSocketReturn<T = unknown> {
  /** Current connection status */
  status: WebSocketStatus;
  /** Whether socket is connected */
  isConnected: boolean;
  /** Connect to WebSocket */
  connect: () => void;
  /** Disconnect from WebSocket */
  disconnect: () => void;
  /** Send message through WebSocket */
  send: (data: unknown) => void;
  /** Last received message */
  lastMessage: T | null;
  /** Connection error */
  error: Event | null;
}

/**
 * Get WebSocket base URL from current location
 */
function getWebSocketBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}`;
}

async function readWebSocketMessageData(data: unknown): Promise<unknown> {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof Blob) {
    return data.text();
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }

  return data;
}

/**
 * Generic WebSocket hook with auto-reconnection
 *
 * @example
 * ```tsx
 * function ContainerLogs({ containerId }: { containerId: string }) {
 *   const [logs, setLogs] = useState<string[]>([]);
 *
 *   const { status, isConnected } = useWebSocket<string>({
 *     path: `/ws/containers/${containerId}/logs`,
 *     onMessage: (log) => setLogs(prev => [...prev, log]),
 *     autoConnect: true,
 *     reconnect: true,
 *   });
 *
 *   return (
 *     <div>
 *       <span>Status: {isConnected ? '🟢' : '🔴'}</span>
 *       <pre>{logs.join('\n')}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebSocket<T = unknown>({
  path,
  onMessage,
  onOpen,
  onClose,
  onError,
  autoConnect = true,
  reconnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
  heartbeatInterval = 30000,
}: UseWebSocketOptions<T>): UseWebSocketReturn<T> {
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const [error, setError] = useState<Event | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualCloseRef = useRef(false);

  /**
   * Clear all timers
   */
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * Setup heartbeat
   */
  const setupHeartbeat = useCallback(
    (ws: WebSocket) => {
      if (heartbeatInterval > 0) {
        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, heartbeatInterval);
      }
    },
    [heartbeatInterval]
  );

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    // Don't connect if already connecting or open
    if (
      wsRef.current?.readyState === WebSocket.CONNECTING ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    clearTimers();
    manualCloseRef.current = false;
    setStatus('connecting');
    setError(null);

    const token = useAuthStore.getState().token;
    const baseUrl = getWebSocketBaseUrl();
    const url = `${baseUrl}${path}${token ? `?token=${token}` : ''}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('open');
        reconnectAttemptsRef.current = 0;
        setupHeartbeat(ws);
        onOpen?.();
      };

      ws.onmessage = async (event) => {
        const payload = await readWebSocketMessageData(event.data);

        try {
          const data = typeof payload === 'string' ? (JSON.parse(payload) as T) : (payload as T);
          setLastMessage(data);
          onMessage?.(data);
        } catch {
          // Handle non-JSON messages
          setLastMessage(payload as T);
          onMessage?.(payload as T);
        }
      };

      ws.onclose = (event) => {
        setStatus('closed');
        clearTimers();
        onClose?.(event);

        // Attempt reconnection if not manually closed
        if (reconnect && !manualCloseRef.current && !event.wasClean) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            reconnectTimerRef.current = setTimeout(() => {
              connect();
            }, reconnectInterval * reconnectAttemptsRef.current);
          }
        }
      };

      ws.onerror = (event) => {
        setStatus('error');
        setError(event);
        onError?.(event);
      };
    } catch (err) {
      setStatus('error');
      setError(err as Event);
      onError?.(err as Event);
    }
  }, [
    path,
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnect,
    reconnectInterval,
    maxReconnectAttempts,
    setupHeartbeat,
    clearTimers,
  ]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    clearTimers();

    if (wsRef.current) {
      setStatus('closing');
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
  }, [clearTimers]);

  /**
   * Send message through WebSocket
   */
  const send = useCallback((data: unknown): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  /**
   * Handle visibility change - reconnect when tab becomes visible
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && reconnect && !manualCloseRef.current) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connect, reconnect]);

  const isConnected = status === 'open';

  return {
    status,
    isConnected,
    connect,
    disconnect,
    send,
    lastMessage,
    error,
  };
}

export default useWebSocket;
