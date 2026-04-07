import React from 'react';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title || 'Подтверждение'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '1rem' }}>
          <p>{message || 'Вы уверены?'}</p>
        </div>
        <div className="modal-actions" style={{ padding: '1rem', display: 'flex', gap: '10px' }}>
          <button className="cancel-btn" onClick={onClose}>Отмена</button>
          <button className="save-btn" onClick={onConfirm} style={{ background: '#e74c3c' }}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;