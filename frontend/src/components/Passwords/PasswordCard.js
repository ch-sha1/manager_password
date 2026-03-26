import React, { useState } from 'react';

function PasswordCard({ password, onEdit, onDelete, onShare }) {
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Скопировано в буфер обмена');
  };

  return (
    <div className="password-card">
      <div className="card-header">
        <h3>{password.site}</h3>
        <div className="card-actions">
          <button onClick={() => onShare(password)} className="share-btn" title="Поделиться">[П]</button>
          <button onClick={() => onEdit(password)} className="edit-btn" title="Редактировать">[Р]</button>
          <button onClick={() => onDelete(password.id)} className="delete-btn" title="Удалить">[X]</button>
        </div>
      </div>
      
      <div className="card-content">
        <p>
          <strong>Логин:</strong> 
          <span onClick={() => copyToClipboard(password.login)} className="clickable">
            {password.login}
          </span>
        </p>
        
        <p>
          <strong>Пароль:</strong>
          <span onClick={() => setShowPassword(!showPassword)} className="clickable">
            {showPassword ? password.password : '********'}
          </span>
          <button onClick={() => copyToClipboard(password.password)} className="copy-btn" title="Копировать">
            [К]
          </button>
        </p>
        
        {password.category && (
          <p><strong>Категория:</strong> {password.category}</p>
        )}
      </div>
    </div>
  );
}

export default PasswordCard;
