import { useEffect, useRef } from 'react';
import { connectRealtime, type RealtimeEvent, type RealtimeConnection } from '@bem-control/api-client';
import { getToken } from '../state/authStore';
import { WS_URL } from '../lib/config';

/** Subscribes to live telemetry/status events for the given org for as long as the component is mounted. */
export function useRealtime(orgId: string | null, onEvent: (event: RealtimeEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!orgId) return;
    let connection: RealtimeConnection | null = null;
    let cancelled = false;

    getToken().then((token) => {
      if (!token || cancelled) return;
      connection = connectRealtime({
        wsUrl: WS_URL,
        token,
        orgId,
        onEvent: (event) => handlerRef.current(event),
      });
    });

    return () => {
      cancelled = true;
      connection?.close();
    };
  }, [orgId]);
}
