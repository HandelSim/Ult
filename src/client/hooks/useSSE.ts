/**
 * useSSE - Custom hook for Server-Sent Events subscriptions.
 * Handles connection, reconnection, and cleanup automatically.
 */
import { useEffect, useRef, useCallback } from 'react';

type SSEEventHandler = (event: string, data: unknown) => void;

interface UseSSEOptions {
  onMessage?: SSEEventHandler;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  reconnectDelay?: number;
  maxReconnects?: number;
}

/**
 * Subscribe to an SSE endpoint and receive typed events.
 * Automatically reconnects on connection loss (with backoff).
 *
 * Callbacks are stored in refs so that changing them never triggers a
 * reconnect — only a URL change causes the connection to be replaced.
 */
export function useSSE(url: string, options: UseSSEOptions = {}) {
  const {
    onMessage,
    onError,
    onOpen,
    reconnectDelay = 3000,
    maxReconnects = 10,
  } = options;

  const esRef = useRef<EventSource | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  // Keep latest callbacks in refs — updating them never triggers a reconnect
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onOpenRef = useRef(onOpen);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;
  onOpenRef.current = onOpen;

  const connect = useCallback(() => {
    if (!isMounted.current || !url) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      reconnectCount.current = 0;
      onOpenRef.current?.();
    };

    // Handle specific named events from the server
    const namedEvents = [
      'connected', 'node:status', 'node:created', 'node:updated', 'node:deleted',
      'log:output', 'log:error', 'log:complete', 'log:history',
      'verification', 'project:created', 'project:updated', 'project:deleted', 'project:status',
      'contract:created', 'contract:updated', 'contract:deleted',
      'blacksmith:status', 'blacksmith:text', 'blacksmith:tool_use', 'blacksmith:done',
      'blacksmith:error', 'blacksmith:decomposed', 'blacksmith:mockup',
    ];

    for (const eventName of namedEvents) {
      es.addEventListener(eventName, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          onMessageRef.current?.(eventName, data);
        } catch {
          onMessageRef.current?.(eventName, e.data);
        }
      });
    }

    // Fallback for unnamed messages
    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current?.('message', data);
      } catch {
        onMessageRef.current?.('message', e.data);
      }
    };

    es.onerror = (error) => {
      onErrorRef.current?.(error);
      es.close();

      if (!isMounted.current) return;

      if (reconnectCount.current < maxReconnects) {
        reconnectCount.current++;
        const delay = reconnectDelay * Math.min(reconnectCount.current, 5);
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };
  }, [url, reconnectDelay, maxReconnects]); // callbacks excluded — handled via refs

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      esRef.current?.close();
    };
  }, [connect]);

  const close = useCallback(() => {
    esRef.current?.close();
  }, []);

  return { close };
}
