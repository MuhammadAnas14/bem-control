import { useEffect, useRef } from 'react';
import { connectRealtime, type RealtimeEvent } from '@bem-control/api-client';
import { getToken } from '../state/authStore';
import { WS_URL } from '../lib/apiClient';

/** Subscribes to live telemetry/status events for the given org for as long as the component is mounted. */
export function useRealtime(orgId: string | null, onEvent: (event: RealtimeEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const token = getToken();
    if (!orgId || !token) return;

    const connection = connectRealtime({
      wsUrl: WS_URL,
      token,
      orgId,
      onEvent: (event) => handlerRef.current(event),
    });

    return () => connection.close();
  }, [orgId]);
}
