import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import CryptoJS from 'crypto-js';
import {
    loadBackupSettings,
    saveBackupSettings,
    getLastBackupAt,
    pickBackupDirectory,
    createEncryptedBackup,
    getDirectoryHandle
} from '../../services/backupService';

function SettingsModal({ isOpen, onClose, onImportSuccess, theme, setTheme }) {
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [twoFAEmail, setTwoFAEmail] = useState('');
    const [backupInterval, setBackupInterval] = useState('never');
    const [backupPath, setBackupPath] = useState('');
    const [lastBackupAt, setLastBackupAt] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);

    const [currentMasterPassword, setCurrentMasterPassword] = useState('');
    const [newMasterPassword, setNewMasterPassword] = useState('');
    const [confirmNewMasterPassword, setConfirmNewMasterPassword] = useState('');

    const [importOldMasterPassword, setImportOldMasterPassword] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadSettings();
            resetSensitiveFields();
        }
    }, [isOpen]);

    const resetSensitiveFields = () => {
        setCurrentMasterPassword('');
        setNewMasterPassword('');
        setConfirmNewMasterPassword('');
        setImportOldMasterPassword('');
    };

    const handleClose = () => {
        resetSensitiveFields();
        onClose();
    };

    const loadSettings = async () => {
        try {
            setIsLoadingSettings(true);

            const response = await api.get('/auth/settings');
            setTwoFAEnabled(!!response.data.twoFAEnabled);
            setTwoFAEmail(response.data.twoFAEmail || '');

            const backupSettings = loadBackupSettings();
            setBackupInterval(backupSettings.interval || 'never');
            setBackupPath(backupSettings.directoryName || '');

            const savedLastBackup = getLastBackupAt();
            setLastBackupAt(savedLastBackup || '');

            const handle = await getDirectoryHandle();
            if (handle?.name) {
                setBackupPath(handle.name);
            }
        } catch (err) {
            console.error('Ошибка загрузки настроек:', err);
            toast.error(err.response?.data?.detail || 'Ошибка загрузки настроек');
        } finally {
            setIsLoadingSettings(false);
        }
    };

    const convertToCSV = (passwords) => {
        const headers = ['site', 'login', 'password', 'group_name'];
        const rows = passwords.map((p) => [
            `"${(p.site || '').replace(/"/g, '""')}"`,
            `"${(p.login || '').replace(/"/g, '""')}"`,
            `"${(p.password || '').replace(/"/g, '""')}"`,
            `"${(p.group_name || '').replace(/"/g, '""')}"`
        ]);

        return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    };

    const parseCSV = (csvText) => {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];

        const result = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const row = [];
            let inQuote = false;
            let current = '';

            for (let j = 0; j < lines[i].length; j++) {
                const char = lines[i][j];

                if (char === '"') {
                    if (inQuote && lines[i][j + 1] === '"') {
                        current += '"';
                        j++;
                    } else {
                        inQuote = !inQuote;
                    }
                } else if (char === ',' && !inQuote) {
                    row.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }

            row.push(current);

            if (row.length >= 3) {
                result.push({
                    site: row[0] || '',
                    login: row[1] || '',
                    password: row[2] || '',
                    group_name: row[3] || ''
                });
            }
        }

        return result;
    };

    const getOrCreateGroup = async (groupName, cachedGroups) => {
        const trimmed = (groupName || '').trim();
        if (!trimmed) return null;

        const existing = cachedGroups.find(
            (g) => g.name.toLowerCase() === trimmed.toLowerCase()
        );

        if (existing) return existing.id;

        const response = await api.post('/passwords/groups', { name: trimmed });
        cachedGroups.push(response.data);
        return response.data.id;
    };

    const handleExport = async () => {
        try {
            const masterPassword = localStorage.getItem('masterPassword');
            if (!masterPassword) {
                toast.error('Мастер-пароль не найден');
                return;
            }

            toast.loading('Экспорт паролей...', { id: 'export' });

            const response = await api.get('/passwords', {
                params: { master_password: masterPassword }
            });

            if (!response.data || response.data.length === 0) {
                toast.error('Нет паролей для экспорта', { id: 'export' });
                return;
            }

            const csvData = convertToCSV(response.data);

            const exportPackage = {
                version: '2.0',
                timestamp: new Date().toISOString(),
                data: csvData
            };

            const encrypted = CryptoJS.AES.encrypt(
                JSON.stringify(exportPackage),
                masterPassword
            ).toString();

            const blob = new Blob([encrypted], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `passwords_${new Date().toISOString().slice(0, 19)}.csv`;
            a.click();
            URL.revokeObjectURL(url);

            toast.success(`Экспортировано ${response.data.length} паролей`, { id: 'export' });
        } catch (err) {
            console.error('Ошибка экспорта:', err);
            toast.error(err.response?.data?.detail || 'Ошибка экспорта', { id: 'export' });
        }
    };

    const tryDecryptImportFile = (fileContent, passwordsToTry) => {
        for (const candidatePassword of passwordsToTry) {
            if (!candidatePassword) continue;

            try {
                const bytes = CryptoJS.AES.decrypt(fileContent, candidatePassword);
                const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

                if (!decryptedText) continue;

                try {
                    const exportPackage = JSON.parse(decryptedText);
                    return exportPackage.data || decryptedText;
                } catch {
                    return decryptedText;
                }
            } catch {
                // пробуем следующий пароль
            }
        }

        return null;
    };

    const handleImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const currentMasterPasswordFromStorage = localStorage.getItem('masterPassword');
                if (!currentMasterPasswordFromStorage) {
                    toast.error('Мастер-пароль не найден');
                    return;
                }

                toast.loading('Импорт паролей...', { id: 'import' });

                const fileContent = e.target.result;

                const decrypted = tryDecryptImportFile(fileContent, [
                    currentMasterPasswordFromStorage,
                    importOldMasterPassword.trim()
                ]);

                if (!decrypted) {
                    toast.error(
                        'Не удалось расшифровать файл. Если вы меняли мастер-пароль, введите старый пароль для импорта.',
                        { id: 'import' }
                    );
                    return;
                }

                if (!decrypted.includes('site') && !decrypted.includes(',')) {
                    toast.error('Файл не содержит данных в правильном формате', { id: 'import' });
                    return;
                }

                const importedPasswords = parseCSV(decrypted);

                if (importedPasswords.length === 0) {
                    toast.error('Файл не содержит паролей', { id: 'import' });
                    return;
                }

                const [existingPasswordsResp, groupsResp] = await Promise.all([
                    api.get('/passwords', {
                        params: { master_password: currentMasterPasswordFromStorage }
                    }),
                    api.get('/passwords/groups')
                ]);

                const existingPasswords = existingPasswordsResp.data || [];
                const cachedGroups = [...(groupsResp.data || [])];

                const newPasswords = importedPasswords.filter((imported) =>
                    !existingPasswords.some(
                        (existing) =>
                            existing.site === imported.site &&
                            existing.login === imported.login
                    )
                );

                if (newPasswords.length === 0) {
                    toast.error('Нет новых паролей для импорта (все дубликаты)', { id: 'import' });
                    setImportOldMasterPassword('');
                    return;
                }

                let successCount = 0;

                for (const pwd of newPasswords) {
                    try {
                        let groupId = null;

                        if (pwd.group_name) {
                            groupId = await getOrCreateGroup(pwd.group_name, cachedGroups);
                        }

                        await api.post(
                            '/passwords',
                            {
                                site: pwd.site,
                                login: pwd.login,
                                password: pwd.password,
                                group_id: groupId
                            },
                            {
                                params: { master_password: currentMasterPasswordFromStorage }
                            }
                        );

                        successCount++;
                    } catch (err) {
                        console.error('Ошибка импорта пароля:', pwd.site, err);
                    }
                }

                setImportOldMasterPassword('');

                toast.success(
                    `Импортировано ${successCount} новых паролей (пропущено: ${importedPasswords.length - successCount})`,
                    { id: 'import' }
                );

                if (onImportSuccess && successCount > 0) {
                    onImportSuccess();
                }
            } catch (err) {
                console.error('Ошибка импорта:', err);
                toast.error(err.response?.data?.detail || 'Ошибка импорта', { id: 'import' });
            } finally {
                event.target.value = '';
            }
        };

        reader.readAsText(file);
    };

    const handleChooseBackupFolder = async () => {
        try {
            const handle = await pickBackupDirectory();
            setBackupPath(handle.name || '');
            toast.success('Папка для резервных копий выбрана');
        } catch (err) {
            console.error('Ошибка выбора папки:', err);
            toast.error(err.message || 'Не удалось выбрать папку');
        }
    };

    const formatLastBackup = (iso) => {
        if (!iso) return 'Никогда';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return 'Никогда';
        return date.toLocaleString();
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);

            await api.post('/auth/settings', {
                twoFAEnabled,
                twoFAEmail: twoFAEnabled ? twoFAEmail.trim() : null
            });

            if (currentMasterPassword || newMasterPassword || confirmNewMasterPassword) {
                if (!currentMasterPassword || !newMasterPassword || !confirmNewMasterPassword) {
                    toast.error('Заполните все поля для смены мастер-пароля');
                    return;
                }

                if (newMasterPassword !== confirmNewMasterPassword) {
                    toast.error('Новый пароль и подтверждение не совпадают');
                    return;
                }

                const response = await api.post('/auth/change-master-password', {
                    current_password: currentMasterPassword,
                    new_password: newMasterPassword,
                    confirm_password: confirmNewMasterPassword
                });

                localStorage.setItem('masterPassword', newMasterPassword);

                setCurrentMasterPassword('');
                setNewMasterPassword('');
                setConfirmNewMasterPassword('');

                toast.success(response.data.message || 'Мастер-пароль изменен');
            }

            const previousSettings = loadBackupSettings();
            const previousInterval = previousSettings.interval || 'never';
            const nextInterval = backupInterval || 'never';

            saveBackupSettings({
                interval: nextInterval,
                directoryName: backupPath || previousSettings.directoryName || ''
            });

            if (nextInterval !== 'never' && !backupPath) {
                const handle = await pickBackupDirectory();
                setBackupPath(handle.name || '');

                saveBackupSettings({
                    interval: nextInterval,
                    directoryName: handle.name || ''
                });
            }

            const enablingAutoBackupNow =
                previousInterval === 'never' && nextInterval !== 'never';

            if (enablingAutoBackupNow) {
                const result = await createEncryptedBackup({ showToast: false });
                setLastBackupAt(result.savedAt);
                setBackupPath(result.directoryName || backupPath);
                toast.success('Резервное копирование выполнено');
            }

            toast.success('Настройки сохранены');
            handleClose();
        } catch (err) {
            console.error('Ошибка сохранения настроек:', err);
            toast.error(err.response?.data?.detail || err.message || 'Ошибка сохранения');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div
                className="modal-content settings-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2>Настройки</h2>
                    <button className="close-btn" onClick={handleClose}>×</button>
                </div>

                <div className="settings-content" style={{ padding: '1.5rem' }}>
                    <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.75rem' }}>Тема оформления</h3>

                        <div className="form-group">
                            <label>Тема</label>
                            <select
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                            >
                                <option value="light">Светлая</option>
                                <option value="dark">Тёмная</option>
                            </select>
                        </div>
                    </div>

                    <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.75rem' }}>Двухфакторная защита</h3>

                        {isLoadingSettings ? (
                            <p style={{ color: '#666' }}>Загрузка настроек...</p>
                        ) : (
                            <>
                                <div className="setting-item">
                                        <label className="setting-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={twoFAEnabled}
                                                onChange={(e) => setTwoFAEnabled(e.target.checked)}
                                            />
                                            <span>Включить подтверждение входа кодом из email</span>
                                        </label>
                                </div>

                                {twoFAEnabled && (
                                    <div className="form-group" style={{ marginTop: '12px' }}>
                                        <label>Почта для получения кода</label>
                                        <input
                                            type="email"
                                            value={twoFAEmail}
                                            onChange={(e) => setTwoFAEmail(e.target.value)}
                                            placeholder="Введите email"
                                        />
                                    </div>
                                )}

                                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                                    После включения 2FA при входе будет отправляться 6-значный код на указанную почту.
                                </p>
                            </>
                        )}
                    </div>

                    <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.75rem' }}>Смена мастер-пароля</h3>

                        <div className="form-group">
                            <label>Текущий мастер-пароль</label>
                            <input
                                type="password"
                                value={currentMasterPassword}
                                onChange={(e) => setCurrentMasterPassword(e.target.value)}
                                placeholder="Введите текущий пароль"
                            />
                        </div>

                        <div className="form-group">
                            <label>Новый мастер-пароль</label>
                            <input
                                type="password"
                                value={newMasterPassword}
                                onChange={(e) => setNewMasterPassword(e.target.value)}
                                placeholder="Введите новый пароль"
                            />
                        </div>

                        <div className="form-group">
                            <label>Подтвердите новый мастер-пароль</label>
                            <input
                                type="password"
                                value={confirmNewMasterPassword}
                                onChange={(e) => setConfirmNewMasterPassword(e.target.value)}
                                placeholder="Повторите новый пароль"
                            />
                        </div>
                    </div>

                    <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.75rem' }}>Резервное копирование</h3>

                        <div className="form-group">
                            <label>Интервал автосохранения</label>
                            <select
                                value={backupInterval}
                                onChange={(e) => setBackupInterval(e.target.value)}
                            >
                                <option value="never">Никогда</option>
                                {/* <option value="minute">Каждую минуту (тест)</option> */}
                                <option value="hourly">Каждый час</option>
                                <option value="daily">Ежедневно</option>
                                <option value="weekly">Еженедельно</option>
                                <option value="monthly">Ежемесячно</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Путь резервных копий</label>
                            <div className="inline-row">
                                <input
                                    type="text"
                                    value={backupPath || 'Папка не выбрана'}
                                    readOnly
                                />
                                <button
                                    type="button"
                                    onClick={handleChooseBackupFolder}
                                    className="secondary-btn"
                                >
                                    Выбрать
                                </button>
                            </div>
                        </div>

                        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                            Последнее резервное копирование: {formatLastBackup(lastBackupAt)}
                        </p>
                    </div>

                    <div className="settings-section">
                        <h3 style={{ marginBottom: '0.75rem' }}>Импорт / Экспорт</h3>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                            <button
                                onClick={handleExport}
                                className="secondary-btn"
                            >
                                📤 Экспорт
                            </button>

                            <label
                                className="secondary-btn"
                                style={{ display: 'inline-block' }}
                            >
                                📥 Импорт
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleImport}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>

                        <div className="form-group">
                            <label>Старый мастер-пароль для импорта</label>
                            <input
                                type="password"
                                value={importOldMasterPassword}
                                onChange={(e) => setImportOldMasterPassword(e.target.value)}
                                placeholder="Нужен только если экспорт был сделан до смены мастер-пароля"
                            />
                        </div>

                        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                            Экспорт шифруется мастер-паролем. Если после экспорта вы меняли мастер-пароль, для импорта старого файла может понадобиться предыдущий мастер-пароль.
                        </p>
                    </div>
                </div>

                <div
                    className="modal-actions"
                    style={{
                        padding: '1rem 1.5rem',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        gap: '10px'
                    }}
                >
                    <button
                        className="cancel-btn"
                        onClick={handleClose}
                        style={{ flex: 1, padding: '8px' }}
                        disabled={isSaving}
                    >
                        Отмена
                    </button>

                    <button
                        className="save-btn"
                        onClick={handleSave}
                        style={{ flex: 1, padding: '8px' }}
                        disabled={isSaving || isLoadingSettings}
                    >
                        {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;