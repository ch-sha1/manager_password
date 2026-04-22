import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

function PasswordCard({
    password,
    onEdit,
    onDelete,
    onShare,
    isSelected,
    onToggleSelect,
    onStartDrag
}) {
    const [showPassword, setShowPassword] = useState(false);

    const copyToClipboard = (text, type) => {
        navigator.clipboard.writeText(text);
        toast.success(`${type} скопирован`);
    };

    return (
        <div
            className={`password-card ${isSelected ? 'selected' : ''}`}
            draggable
            onDragStart={() => onStartDrag(password.id)}
        >
            <div className="card-top-row">
                <label className="select-checkbox">
                    <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => onToggleSelect(password.id)}
                    />
                </label>

                <span className="drag-handle" title="Перетащить">⋮⋮</span>
            </div>

            <div className="card-header">
                <h3 title={password.site}>{password.site}</h3>
            </div>

            <div className="card-content">
                <p>
                    <strong>Логин:</strong>
                    <span
                        onClick={() => copyToClipboard(password.login, 'Логин')}
                        className="clickable"
                        title={password.login}
                    >
                        {password.login}
                    </span>
                </p>

                <p>
                    <strong>Пароль:</strong>
                    <span
                        onClick={() => setShowPassword(!showPassword)}
                        className="clickable"
                        title={showPassword ? password.password : 'Нажмите, чтобы показать'}
                    >
                        {showPassword ? password.password : '••••••'}
                    </span>
                    <button
                        onClick={() => copyToClipboard(password.password, 'Пароль')}
                        className="copy-btn"
                        title="Копировать"
                    >
                        📋
                    </button>
                </p>

                {password.group_name && (
                    <p>
                        <strong>Группа:</strong>
                        <span className="group-badge-card">{password.group_name}</span>
                    </p>
                )}
            </div>

            <div className="card-footer">
                <button
                    onClick={() => onShare(password)}
                    className="share-btn"
                    title="Поделиться"
                >
                    🔗
                </button>
                <button
                    onClick={() => onEdit(password)}
                    className="edit-btn"
                    title="Редактировать"
                >
                    ✏️
                </button>
                <button
                    onClick={() => onDelete(password.id)}
                    className="delete-btn"
                    title="Удалить"
                >
                    🗑️
                </button>
            </div>
        </div>
    );
}

export default PasswordCard;