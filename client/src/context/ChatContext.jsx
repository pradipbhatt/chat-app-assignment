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

  const lastJoin = useRef(null);
  const noticeTimer = useRef(null);

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
          }
        });
      }
    };

    const onDisconnect = () => setConnection('disconnected');
    const onConnecting = () => setConnection('connecting');
    const onMessage = (message) => setMessages((current) => [...current, message]);
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
    setConnection('connected');

    return response;
  }, []);

  const send = useCallback(async (text) => {
    const response = await emitWithAck('message:send', { text });
    if (!response.ok) showNotice('danger', response.message);
    return response;
  }, [showNotice]);

  const leave = useCallback(() => {
    const socket = getSocket();
    socket.emit('room:leave');
    socket.disconnect();
    lastJoin.current = null;
    setSession(null);
    setMessages([]);
    setUsers([]);
    setConnection('disconnected');
  }, []);

  const value = useMemo(
    () => ({ session, messages, users, connection, notice, join, send, leave, dismissNotice: () => setNotice(null) }),
    [session, messages, users, connection, notice, join, send, leave],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside a ChatProvider.');
  return context;
}
