import { useCallback, useEffect, useState } from 'react';
import { emitWithAck } from '../lib/socket.js';

export function useAdmin(enabled) {
  const [overview, setOverview] = useState({ rooms: [], users: [], totals: null });
  const [bans, setBans] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setStatus('loading');
    const [overviewResponse, bansResponse] = await Promise.all([
      emitWithAck('admin:overview'),
      emitWithAck('admin:bans'),
    ]);

    if (overviewResponse.ok) {
      setOverview({
        rooms: overviewResponse.rooms ?? [],
        users: overviewResponse.users ?? [],
        totals: overviewResponse.totals ?? null,
      });
      setError(null);
    } else {
      setError(overviewResponse.message);
    }

    if (bansResponse.ok) setBans(bansResponse.bans ?? []);
    setStatus('ready');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  const run = useCallback(
    async (event, payload) => {
      const response = await emitWithAck(event, payload);
      if (!response.ok) setError(response.message);
      else setError(null);
      await refresh();
      return response;
    },
    [refresh],
  );

  return {
    overview,
    bans,
    status,
    error,
    refresh,
    clearError: () => setError(null),
    kick: (username, room, reason) => run('admin:kick', { username, room, reason }),
    ban: (username, room, reason, minutes) => run('admin:ban', { username, room, reason, minutes }),
    unban: (id) => run('admin:unban', { id }),
    deleteMessage: (id) => run('admin:delete-message', { id }),
    clearRoom: (room) => run('admin:clear-room', { room }),
  };
}
