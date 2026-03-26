import React, { useState } from 'react';
import api from '../../services/api';

function SettingsModal({ isOpen, onClose }) {
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [backupInterval, setBackupInterval] = useState('daily');
  const [backupPath, setBackupPath] = useState('C:/Backups');

  const handleSave = async () => {
    try {
      await api.post('/settings', {
        twoFAEnabled,
        backupInterval,
        backupPath
      });
      alert('Настройки сохранены');
      onClose();
    } catch (err) {
      console.error('Ошибка сохранения настроек:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Настройки</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-content" style={{ padding: '1.5rem' }}>
          <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
            <h3>Двухфакторная аутентификация (2FA)</h3>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={twoFAEnabled}
                  onChange={(e) => setTwoFAEnabled(e.target.checked)}
                />
                Включить 2FA
              </label>
              {twoFAEnabled && (
                <div className="twofa-info" style={{ marginTop: '10px' }}>
                  <p>Отсканируйте QR-код в приложении-аутентификаторе:</p>
                  <div className="qr-placeholder" style={{ 
                    background: '#f0f0f0', 
                    padding: '20px', 
                    textAlign: 'center',
                    marginTop: '10px'
                  }}>
                    [QR-код будет здесь]
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
            <h3>Резервное копирование</h3>
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
              <label>Папка для сохранения:</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                <input 
                  type="text" 
                  value={backupPath} 
                  onChange={(e) => setBackupPath(e.target.value)}
                  style={{ flex: 1, padding: '5px' }}
                />
                <button className="browse-btn" style={{ padding: '5px 10px' }}>Обзор</button>
              </div>
            </div>
          </div>
          
          <div className="settings-section">
            <h3>Импорт/Экспорт</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="import-btn" style={{ padding: '8px 16px', cursor: 'pointer' }}>Импорт</button>
              <button className="export-btn" style={{ padding: '8px 16px', cursor: 'pointer' }}>Экспорт</button>
            </div>
          </div>
        </div>
        
        <div className="modal-actions" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
          <button className="cancel-btn" onClick={onClose} style={{ flex: 1, padding: '8px' }}>Отмена</button>
          <button className="save-btn" onClick={handleSave} style={{ flex: 1, padding: '8px', background: '#48bb78', color: 'white', border: 'none', borderRadius: '6px' }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
