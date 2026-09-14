import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket, emitWithAck } from '../lib/socket.js';

const MAX_KEPT = 300;

export function useServerLogs(enabled) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState(null);
  const [state, setState] = useState('idle');
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!enabled) return undefined;

    const socket = getSocket();
    let active = true;

    const onLog = (entry) => {
      if (pausedRef.current) return;
      setEntries((current) => {
        const next = [...current, entry];
        return next.length > MAX_KEPT ? next.slice(next.length - MAX_KEPT) : next;
      });
    };

    const onStatus = (payload) => setStatus(payload);

    socket.on('admin:log', onLog);
    socket.on('admin:status', onStatus);

    setState('loading');
    emitWithAck('admin:logs:subscribe', { limit: 150 }).then((response) => {
      if (!active) return;
      if (!response.ok) {
        setState('error');
        return;
      }
      setEntries(response.entries ?? []);
      setStatus(response.status ?? null);
      setState('ready');
    });

    return () => {
      active = false;
      socket.off('admin:log', onLog);
      socket.off('admin:status', onStatus);
      emitWithAck('admin:logs:unsubscribe');
    };
  }, [enabled]);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, status, state, paused, setPaused, clear };
}
