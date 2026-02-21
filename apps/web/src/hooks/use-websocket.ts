'use client';

import { useEffect, useRef } from 'react';
import { BASE, ADMIN_KEY } from '@/lib/api';

export function useWebSocket(onEvent: (event: string, data: unknown) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!ADMIN_KEY) return;

    let ws: WebSocket;
    let retries = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;

    function connect() {
      const wsUrl = `${BASE.replace(/^http/, 'ws')}/ws?adminKey=${ADMIN_KEY}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        retries = 0;
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30_000);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as {
            event?: string;
            type?: string;
            data: unknown;
          };
          if (msg.event) {
            onEventRef.current(msg.event, msg.data);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (!destroyed) {
          const delay = Math.min(1000 * Math.pow(2, retries), 30_000);
          retries++;
          reconnectTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingInterval) clearInterval(pingInterval);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
