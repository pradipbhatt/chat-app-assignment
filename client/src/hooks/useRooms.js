import { useCallback, useEffect, useState } from 'react';
import { getRooms } from '../lib/api.js';

export function useRooms() {
  const [rooms, setRooms] = useState([]);
  const [status, setStatus] = useState('loading');

  const refresh = useCallback(async () => {
    try {
      const data = await getRooms();
      setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) return;
      await refresh();
    };

    load();
    const timer = setInterval(load, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);

  return { rooms, status, refresh };
}
