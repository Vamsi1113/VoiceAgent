import { useState } from 'react';
import Chat from './pages/Chat.js';
import Login from './pages/Login.js';
import './App.css';

export default function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('companion_token'),
  );

  const handleLogin = (tok: string) => {
    localStorage.setItem('companion_token', tok);
    setToken(tok);
  };

  const handleLogout = () => {
    localStorage.removeItem('companion_token');
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return <Chat token={token} onLogout={handleLogout} />;
}

