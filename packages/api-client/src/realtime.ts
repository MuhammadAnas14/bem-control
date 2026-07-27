import type { RealtimeEvent } from './types';

export interface RealtimeConnectionOptions {
  /** e.g. ws://localhost:4001 or wss://api.example.com */
  wsUrl: string;
  token: string;
  orgId: string;
  onEvent: (event: RealtimeEvent) => void;
  onStatusChange?: (status: 'connecting' | 'open' | 'closed') => void;
}

export interface RealtimeConnection {
  close: () => void;
}

/**
 * Thin wrapper around the platform's native WebSocket (available as a
 * global on both web and React Native, so this file has no
 * platform-specific imports) with basic auto-reconnect - live telemetry
 * should survive a dropped connection without the user re-opening the screen.
 */
export function connectRealtime(options: RealtimeConnectionOptions): RealtimeConnection {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let reconnectDelayMs = 1000;

  const url = `${options.wsUrl}?token=${encodeURIComponent(
    options.token
  )}&orgId=${encodeURIComponent(options.orgId)}`;

  function connect() {
    options.onStatusChange?.('connecting');
    socket = new WebSocket(url);

    socket.onopen = () => {
      reconnectDelayMs = 1000;
      options.onStatusChange?.('open');
    };

    socket.onmessage = (event) => {
      try {
        options.onEvent(JSON.parse(event.data));
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = () => {
      options.onStatusChange?.('closed');
      if (closedByCaller) return;
      setTimeout(connect, reconnectDelayMs);
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
    };
  }

  connect();

  return {
    close: () => {
      closedByCaller = true;
      socket?.close();
    },
  };
}
