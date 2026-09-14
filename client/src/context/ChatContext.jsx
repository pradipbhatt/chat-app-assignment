import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getSocket, connectSocket, emitWithAck } from '../lib/socket.js';
import { normaliseRoom } from '../lib/validation.js';

const ChatContext = createContext(null);

const MAX_NOTICE_AGE_MS = 6000;

export function ChatProvider({ children }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [connection, setConnection] = useState('disconnected');
  const [notice, setNotice] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [pending, setPending] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const lastJoin = useRef(null);
  const noticeTimer = useRef(null);
  const typingSent = useRef(false);
  const typingTimer = useRef(null);

  const showNotice = useCallback((tone, message) => {
    setNotice({ tone, message, at: Date.now() });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), MAX_NOTICE_AGE_MS);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnection('connected');
      if (lastJoin.current) {
        socket.emit('room:join', lastJoin.current, (response) => {
          if (response?.ok) {
            setUsers(response.users ?? []);
            setMessages(response.history ?? []);
            setHasMore(Boolean(response.hasMore));
          }
        });
      }
    };

    const onDisconnect = () => setConnection('disconnected');
    const onConnecting = () => setConnection('connecting');
    const onMessage = (message) => {
      setMessages((current) => [...current, message]);
      if (!message.system) {
        setTypingUsers((current) => current.filter((name) => name !== message.username));
      }
    };
    const onTypingStart = (payload) =>
      setTypingUsers((current) =>
        current.includes(payload.username) ? current : [...current, payload.username],
      );
    const onTypingStop = (payload) =>
      setTypingUsers((current) => current.filter((name) => name !== payload.username));
    const onUsers = (payload) => setUsers(payload.users ?? []);
    const onDeleted = (payload) =>
      setMessages((current) => current.filter((message) => message.id !== payload.id));
    const onCleared = () => {
      setMessages([]);
      showNotice('info', 'An administrator cleared this room.');
    };
    const onKicked = (payload) => {
      lastJoin.current = null;
      setSession(null);
      setMessages([]);
      setUsers([]);
      showNotice('danger', payload.reason ? `Removed: ${payload.reason}` : 'You were removed.');
    };
    const onAppError = (payload) => showNotice('danger', payload.message);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onConnecting);
    socket.on('message:new', onMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('room:users', onUsers);
    socket.on('message:deleted', onDeleted);
    socket.on('room:cleared', onCleared);
    socket.on('moderation:kicked', onKicked);
    socket.on('error:app', onAppError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onConnecting);
      socket.off('message:new', onMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('room:users', onUsers);
      socket.off('message:deleted', onDeleted);
      socket.off('room:cleared', onCleared);
      socket.off('moderation:kicked', onKicked);
      socket.off('error:app', onAppError);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [showNotice]);

  const join = useCallback(async (username, room) => {
    const payload = { username: String(username).trim(), room: normaliseRoom(room) };

    setConnection('connecting');
    connectSocket();

    const response = await emitWithAck('room:join', payload);

    if (!response.ok) {
      setConnection(getSocket().connected ? 'connected' : 'disconnected');
      return response;
    }

    lastJoin.current = payload;
    setSession({ room: response.room, username: response.username, role: response.role });
    setMessages(response.history ?? []);
    setUsers(response.users ?? []);
    setHasMore(Boolean(response.hasMore));
    setTypingUsers([]);
    setPending([]);
    setConnection('connected');

    return response;
  }, []);

  const stopTyping = useCallback(() => {
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    if (typingSent.current) {
      typingSent.current = false;
      getSocket().emit('typing:stop');
    }
  }, []);

  const signalTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    if (!typingSent.current) {
      typingSent.current = true;
      socket.emit('typing:start');
    }

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 1800);
  }, [stopTyping]);

  const send = useCallback(
    async (text) => {
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setPending((current) => [...current, { tempId, text, status: 'sending' }]);
      stopTyping();

      const response = await emitWithAck('message:send', { text });

      if (response.ok) {
        setPending((current) => current.filter((entry) => entry.tempId !== tempId));
        return response;
      }

      setPending((current) =>
        current.map((entry) =>
          entry.tempId === tempId
            ? { ...entry, status: 'failed', reason: response.message }
            : entry,
        ),
      );
      return response;
    },
    [stopTyping],
  );

  const retryPending = useCallback(async (tempId) => {
    let text = null;
    setPending((current) =>
      current.map((entry) => {
        if (entry.tempId !== tempId) return entry;
        text = entry.text;
        return { ...entry, status: 'sending', reason: undefined };
      }),
    );

    if (!text) return;

    const response = await emitWithAck('message:send', { text });

    setPending((current) =>
      response.ok
        ? current.filter((entry) => entry.tempId !== tempId)
        : current.map((entry) =>
            entry.tempId === tempId
              ? { ...entry, status: 'failed', reason: response.message }
              : entry,
          ),
    );
  }, []);

  const discardPending = useCallback((tempId) => {
    setPending((current) => current.filter((entry) => entry.tempId !== tempId));
  }, []);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || messages.length === 0) return null;

    setLoadingOlder(true);
    const response = await emitWithAck('messages:load', {
      before: messages[0].ts,
      limit: 30,
    });
    setLoadingOlder(false);

    if (!response.ok) {
      showNotice('danger', response.message);
      return null;
    }

    setMessages((current) => [...response.messages, ...current]);
    setHasMore(Boolean(response.hasMore));
    return response;
  }, [loadingOlder, messages, showNotice]);

  const leave = useCallback(() => {
    const socket = getSocket();
    socket.emit('room:leave');
    socket.disconnect();
    lastJoin.current = null;
    setSession(null);
    setMessages([]);
    setUsers([]);
    setTypingUsers([]);
    setPending([]);
    setHasMore(false);
    setConnection('disconnected');
  }, []);

  const value = useMemo(
    () => ({
      session,
      messages,
      users,
      connection,
      notice,
      typingUsers,
      pending,
      hasMore,
      loadingOlder,
      join,
      send,
      leave,
      signalTyping,
      retryPending,
      discardPending,
      loadOlder,
      dismissNotice: () => setNotice(null),
    }),
    [
      session,
      messages,
      users,
      connection,
      notice,
      typingUsers,
      pending,
      hasMore,
      loadingOlder,
      join,
      send,
      leave,
      signalTyping,
      retryPending,
      discardPending,
      loadOlder,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside a ChatProvider.');
  return context;
}
