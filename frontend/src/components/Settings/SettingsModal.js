import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import CryptoJS from 'crypto-js';

function SettingsModal({ isOpen, onClose, onImportSuccess }) {
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [twoFAEmail, setTwoFAEmail] = useState('');
    const [backupInterval, setBackupInterval] = useState('daily');
    const [backupPath, setBackupPath] = useState('C:/Backups');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            setIsLoadingSettings(true);
            const response = await api.get('/auth/settings');
            setTwoFAEnabled(!!response.data.twoFAEnabled);
            setTwoFAEmail(response.data.twoFAEmail || '');
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

    const handleImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const masterPassword = localStorage.getItem('masterPassword');
                if (!masterPassword) {
                    toast.error('Мастер-пароль не найден');
                    return;
                }

                toast.loading('Импорт паролей...', { id: 'import' });

                const fileContent = e.target.result;
                let decrypted;

                try {
                    const bytes = CryptoJS.AES.decrypt(fileContent, masterPassword);
                    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

                    if (!decryptedText) {
                        throw new Error('Расшифровка не удалась');
                    }

                    try {
                        const exportPackage = JSON.parse(decryptedText);
                        decrypted = exportPackage.data || decryptedText;
                    } catch {
                        decrypted = decryptedText;
                    }
                } catch {
                    toast.error('Неверный мастер-пароль или файл поврежден', { id: 'import' });
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
                        params: { master_password: masterPassword }
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
                                params: { master_password: masterPassword }
                            }
                        );

                        successCount++;
                    } catch (err) {
                        console.error('Ошибка импорта пароля:', pwd.site, err);
                    }
                }

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

    const handleSave = async () => {
        try {
            setIsSaving(true);

            await api.post('/auth/settings', {
                twoFAEnabled,
                twoFAEmail: twoFAEnabled ? twoFAEmail.trim() : null,
                backupInterval,
                backupPath
            });

            toast.success(
                twoFAEnabled
                    ? '2FA по почте включена'
                    : '2FA по почте отключена'
            );

            onClose();
        } catch (err) {
            console.error('Ошибка сохранения настроек:', err);
            toast.error(err.response?.data?.detail || 'Ошибка сохранения');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content settings-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2>Настройки</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="settings-content" style={{ padding: '1.5rem' }}>
                    <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.75rem' }}>Двухфакторная защита</h3>

                        {isLoadingSettings ? (
                            <p style={{ color: '#666' }}>Загрузка настроек...</p>
                        ) : (
                            <>
                                <div className="setting-item">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input
                                            type="checkbox"
                                            checked={twoFAEnabled}
                                            onChange={(e) => setTwoFAEnabled(e.target.checked)}
                                        />
                                        Включить подтверждение входа кодом из email
                                    </label>
                                </div>

                                {twoFAEnabled && (
                                    <div className="setting-item" style={{ marginTop: '12px' }}>
                                        <label>Почта для получения кода</label>
                                        <input
                                            type="email"
                                            value={twoFAEmail}
                                            onChange={(e) => setTwoFAEmail(e.target.value)}
                                            placeholder="Введите email"
                                            style={{ marginTop: '8px', width: '100%', padding: '8px' }}
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
                        <h3 style={{ marginBottom: '0.75rem' }}>Резервное копирование</h3>

                        <div className="setting-item" style={{ marginBottom: '10px' }}>
                            <label>Интервал автосохранения:</label>
                            <select
                                value={backupInterval}
                                onChange={(e) => setBackupInterval(e.target.value)}
                                style={{ marginLeft: '10px', padding: '5px' }}
                            >
                                <option value="hourly">Каждый час</option>
                                <option value="daily">Ежедневно</option>
                                <option value="weekly">Еженедельно</option>
                                <option value="monthly">Ежемесячно</option>
                            </select>
                        </div>

                        <div className="setting-item">
                            <label>Путь резервных копий:</label>
                            <input
                                type="text"
                                value={backupPath}
                                onChange={(e) => setBackupPath(e.target.value)}
                                style={{ marginTop: '8px' }}
                                placeholder="Например: C:/Backups"
                            />
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3 style={{ marginBottom: '0.75rem' }}>Импорт / Экспорт</h3>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleExport}
                                className="export-btn"
                                style={{
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    background: '#4299e1',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px'
                                }}
                            >
                                📤 Экспорт
                            </button>

                            <label
                                className="import-btn"
                                style={{
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    background: '#48bb78',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    display: 'inline-block'
                                }}
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

                        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                            Экспорт шифруется мастер-паролем. При импорте группы создаются автоматически.
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
                        onClick={onClose}
                        style={{ flex: 1, padding: '8px' }}
                        disabled={isSaving}
                    >
                        Отмена
                    </button>

                    <button
                        className="save-btn"
                        onClick={handleSave}
                        style={{
                            flex: 1,
                            padding: '8px',
                            background: '#48bb78',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px'
                        }}
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