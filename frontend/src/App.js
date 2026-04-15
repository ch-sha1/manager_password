import React, { useState, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import './App.css';
import Login from './components/Auth/Login';
import PasswordList from './components/Passwords/PasswordList';
import SettingsModal from './components/Settings/SettingsModal';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [showSettings, setShowSettings] = useState(false);
  const passwordListRef = useRef();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('masterPassword');
    toast.success('Вы вышли из системы');
    setIsAuthenticated(false);
  };

  const handleImportSuccess = () => {
    if (passwordListRef.current) {
      passwordListRef.current.loadPasswords();
    }
    toast.success('Пароли импортированы, список обновлен');
  };

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" />
        <Login onLogin={() => setIsAuthenticated(true)} />
      </>
    );
  }

  return (
    <div className="App">
      <Toaster position="top-center" />
      <header className="app-header">
        <h1>Менеджер паролей</h1>
        <div className="header-actions">
          <button onClick={() => setShowSettings(true)} className="settings-btn">
            Настройки
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Выйти
          </button>
        </div>
      </header>

      <main className="app-main">
        <PasswordList ref={passwordListRef} />
      </main>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}

export default App;