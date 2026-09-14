import { useEffect, useState } from 'react';
import { useChat } from './context/ChatContext.jsx';
import { JoinPage } from './pages/JoinPage.jsx';
import { ChatPage } from './pages/ChatPage.jsx';
import { AdminDashboard } from './pages/AdminDashboard.jsx';

const isAdminPath = () =>
  typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/admin';

export default function App() {
  const { session } = useChat();
  const [adminRoute, setAdminRoute] = useState(isAdminPath);

  useEffect(() => {
    const onPopState = () => setAdminRoute(isAdminPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (adminRoute) return <AdminDashboard />;

  return session ? <ChatPage /> : <JoinPage />;
}
