import React, { useState, useRef, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import './App.css';
import Login from './components/Auth/Login';
import PasswordList from './components/Passwords/PasswordList';
import SettingsModal from './components/Settings/SettingsModal';
import ShareImportModal from './components/Passwords/ShareImportModal';
import { runScheduledBackupIfNeeded } from './services/backupService';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [shareToken, setShareToken] = useState(null);

    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'light';
    });

    const passwordListRef = useRef();

    useEffect(() => {
        document.body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const path = window.location.pathname;

        if (path.startsWith('/share/')) {
            const token = path.replace('/share/', '');
            setShareToken(token);
            window.history.replaceState({}, '', '/');
        }

        localStorage.removeItem('token');
        localStorage.removeItem('masterPassword');
        setIsAuthenticated(false);
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;

        let isMounted = true;

        const checkBackup = async () => {
            try {
                if (!isMounted) return;
                await runScheduledBackupIfNeeded(toast);
            } catch (err) {
                console.error('Ошибка автокопирования:', err);
            }
        };

        checkBackup();

        const intervalId = setInterval(checkBackup, 5 * 1000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [isAuthenticated]);

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
        <div className={`App ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
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
                theme={theme}
                setTheme={setTheme}
            />

            {shareToken && (
                <ShareImportModal
                    token={shareToken}
                    onClose={() => setShareToken(null)}
                    onSuccess={handleImportSuccess}
                />
            )}
        </div>
    );
}

export default App;