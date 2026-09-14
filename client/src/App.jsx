import { useEffect, useState } from 'react';
import { useChat } from './context/ChatContext.jsx';
import { JoinPage } from './pages/JoinPage.jsx';
import { ChatPage } from './pages/ChatPage.jsx';
import { AdminDashboard } from './pages/AdminDashboard.jsx';
import { StatusPage } from './pages/StatusPage.jsx';

const currentRoute = () => {
  if (typeof window === 'undefined') return 'chat';

  const path = window.location.pathname.replace(/\/+$/, '');
  const host = window.location.hostname;

  if (path === '/admin') return 'admin';
  if (path === '/status' || host.startsWith('status.') || host.startsWith('pradipchat-status')) {
    return 'status';
  }
  return 'chat';
};

export default function App() {
  const { session, restoring } = useChat();
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onPopState = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (route === 'admin') return <AdminDashboard />;
  if (route === 'status') return <StatusPage />;

  if (restoring && !session) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-fg-muted">Rejoining your room…</p>
      </main>
    );
  }

  return session ? <ChatPage /> : <JoinPage />;
}
