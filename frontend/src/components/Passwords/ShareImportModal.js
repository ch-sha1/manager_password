import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { decryptShareToken } from '../../services/shareService';
import api from '../../services/api';

function ShareImportModal({ token, onClose, onSuccess }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleImport = async () => {
        if (!password.trim()) {
            toast.error('Введите пароль');
            return;
        }

        try {
            setLoading(true);

            const decrypted = decryptShareToken(token, password.trim());
            const items = decrypted.items || [];

            if (!items.length) {
                toast.error('Нет данных');
                return;
            }

            const masterPassword = localStorage.getItem('masterPassword');
            if (!masterPassword) {
                toast.error('Нет мастер-пароля');
                return;
            }

            let success = 0;

            for (const item of items) {
                try {
                    await api.post(
                        '/passwords',
                        {
                            site: item.site,
                            login: item.login,
                            password: item.password,
                            group_id: null
                        },
                        {
                            params: { master_password: masterPassword }
                        }
                    );
                    success++;
                } catch (e) {
                    console.error('Ошибка добавления:', item.site);
                }
            }

            toast.success(`Добавлено ${success} паролей`);

            if (onSuccess) onSuccess();
            onClose();

        } catch (err) {
            console.error(err);
            toast.error('Неверный пароль или ссылка');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Импорт из ссылки</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    <div className="form-group">
                        <label>Пароль для расшифровки</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="modal-actions">
                    <button onClick={onClose} className="cancel-btn">
                        Отмена
                    </button>
                    <button
                        onClick={handleImport}
                        className="save-btn"
                        disabled={loading}
                    >
                        {loading ? 'Импорт...' : 'Импортировать'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ShareImportModal;