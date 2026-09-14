import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as loginRequest, getMe } from '../lib/api.js';
import { setSocketToken } from '../lib/socket.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'chat-admin-token';

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch (error) {
    return null;
  }
};

const writeToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    return;
  }
};

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [token, setToken] = useState(readToken);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    const token = readToken();

    if (!token) {
      setRestoring(false);
      return undefined;
    }

    setSocketToken(token);

    getMe(token)
      .then((data) => {
        if (!active) return;
        setAccount(data.user);
        setRestoring(false);
      })
      .catch(() => {
        if (!active) return;
        writeToken(null);
        setSocketToken(null);
        setToken(null);
        setRestoring(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (username, password) => {
    try {
      const data = await loginRequest(username, password);
      writeToken(data.token);
      setSocketToken(data.token);
      setToken(data.token);
      setAccount(data.user);
      return { ok: true, user: data.user };
    } catch (error) {
      return { ok: false, code: error.code, message: error.message };
    }
  }, []);

  const signOut = useCallback(() => {
    writeToken(null);
    setSocketToken(null);
    setToken(null);
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({ account, token, restoring, signIn, signOut, isAdmin: account?.role === 'admin' }),
    [account, token, restoring, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
