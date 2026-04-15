import React, { useState, useRef } from 'react';
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
    const holdTimer = useRef(null);

    const copyToClipboard = (text, type) => {
        navigator.clipboard.writeText(text);
        toast.success(`${type} скопирован`);
    };

    const handleCheckboxClick = (e) => {
        e.stopPropagation();
        onToggleSelect(password.id);
    };

    const handleDragStart = (e) => {
        if (onStartDrag) {
            onStartDrag(password.id);
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(password.id));
    };

    const startLongPress = () => {
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => {
            onToggleSelect(password.id);
        }, 350);
    };

    const cancelLongPress = () => {
        clearTimeout(holdTimer.current);
    };

    return (
        <div
            className={`password-card ${isSelected ? 'selected' : ''}`}
            draggable
            onDragStart={handleDragStart}
            onTouchStart={startLongPress}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress}
        >
            <div className="card-top-row">
                <label className="select-checkbox" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={handleCheckboxClick}
                    />
                </label>
                <div className="drag-handle" title="Перетащить">⋮⋮</div>
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
                        title="Показать/скрыть пароль"
                    >
                        {showPassword ? password.password : '••••••'}
                    </span>
                    <button
                        onClick={() => copyToClipboard(password.password, 'Пароль')}
                        className="copy-btn"
                        title="Копировать"
                        type="button"
                    >
                        📋
                    </button>
                </p>

                <p>
                    <strong>Группа:</strong>
                    <span className="group-badge-card">
                        {password.group_name || 'Без группы'}
                    </span>
                </p>
            </div>

            <div className="card-footer">
                <button onClick={() => onShare(password)} className="share-btn" title="Поделиться" type="button">🔗</button>
                <button onClick={() => onEdit(password)} className="edit-btn" title="Редактировать" type="button">✏️</button>
                <button onClick={() => onDelete(password.id)} className="delete-btn" title="Удалить" type="button">🗑️</button>
            </div>
        </div>
    );
}

export default PasswordCard;