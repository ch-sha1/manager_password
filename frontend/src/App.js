import React, { useState } from 'react';
import './App.css';
import Login from './components/Auth/Login';
import PasswordList from './components/Passwords/PasswordList';
import SettingsModal from './components/Settings/SettingsModal';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="App">
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
        <PasswordList />
      </main>
      
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  );
}

export default App;
