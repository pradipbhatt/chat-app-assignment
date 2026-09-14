import { useChat } from './context/ChatContext.jsx';
import { JoinPage } from './pages/JoinPage.jsx';
import { ChatPage } from './pages/ChatPage.jsx';

export default function App() {
  const { session } = useChat();
  return session ? <ChatPage /> : <JoinPage />;
}
