import React, { useState } from 'react';

function PasswordCard({ password, onEdit, onDelete, onShare }) {
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Скопировано');
  };

  return (
    <div className="password-card">
      <div className="card-header">
        <h3 title={password.site}>{password.site}</h3>
      </div>
      
      <div className="card-content">
        <p>
          <strong>Логин:</strong>
          <span onClick={() => copyToClipboard(password.login)} className="clickable" title={password.login}>
            {password.login}
          </span>
        </p>
        
        <p>
          <strong>Пароль:</strong>
          <span onClick={() => setShowPassword(!showPassword)} className="clickable">
            {showPassword ? password.password : '••••••'}
          </span>
          <button onClick={() => copyToClipboard(password.password)} className="copy-btn" title="Копировать">
            📋
          </button>
        </p>
        
        {password.category && (
          <p><strong>Кат:</strong> {password.category}</p>
        )}
      </div>
      
      <div className="card-footer">
        <button onClick={() => onShare(password)} className="share-btn" title="Поделиться">🔗</button>
        <button onClick={() => onEdit(password)} className="edit-btn" title="Редактировать">✏️</button>
        <button onClick={() => onDelete(password.id)} className="delete-btn" title="Удалить">🗑️</button>
      </div>
    </div>
  );
}

export default PasswordCard;