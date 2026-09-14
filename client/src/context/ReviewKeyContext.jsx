import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getEscrowVault, unlockEscrowKey } from '../lib/escrowBridge.js';

const ReviewKeyContext = createContext(null);

let heldKey = null;

export function ReviewKeyProvider({ children }) {
  const { token, isAdmin } = useAuth();
  const [key, setKey] = useState(heldKey);
  const [vault, setVault] = useState(null);
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    if (!isAdmin) return;

    if (heldKey) {
      setKey(heldKey);
      setStatus('open');
      return;
    }

    setStatus('checking');
    try {
      const data = await getEscrowVault(token);
      setVault(data.vault);
      setStatus('locked');
    } catch (requestError) {
      setStatus(requestError.code === 'NO_ESCROW' ? 'absent' : 'error');
      if (requestError.code !== 'NO_ESCROW') setError(requestError.message);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    check();
  }, [check]);

  const unlock = useCallback(
    async (passphrase) => {
      if (!vault) return { ok: false, message: 'No review key is set up.' };

      const unlocked = await unlockEscrowKey(vault, passphrase);
      if (!unlocked) return { ok: false, message: 'That passphrase did not open the key.' };

      heldKey = unlocked;
      setKey(unlocked);
      setStatus('open');
      setError(null);
      return { ok: true };
    },
    [vault],
  );

  const forget = useCallback(() => {
    heldKey = null;
    setKey(null);
    setStatus(vault ? 'locked' : 'absent');
  }, [vault]);

  const value = useMemo(
    () => ({ key, status, error, unlock, forget, refresh: check }),
    [key, status, error, unlock, forget, check],
  );

  return <ReviewKeyContext.Provider value={value}>{children}</ReviewKeyContext.Provider>;
}

export function useReviewKey() {
  const context = useContext(ReviewKeyContext);
  if (!context) throw new Error('useReviewKey must be used inside a ReviewKeyProvider.');
  return context;
}
