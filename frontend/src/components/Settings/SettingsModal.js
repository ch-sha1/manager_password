import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import CryptoJS from 'crypto-js';

function SettingsModal({ isOpen, onClose }) {
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [backupInterval, setBackupInterval] = useState('daily');
  const [backupPath, setBackupPath] = useState('C:/Backups');

  // Конвертация паролей в CSV
  const convertToCSV = (passwords) => {
    const headers = ['site', 'login', 'password', 'category'];
    const rows = passwords.map(p => [
      `"${p.site.replace(/"/g, '""')}"`,
      `"${p.login.replace(/"/g, '""')}"`,
      `"${p.password.replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // Парсинг CSV в массив объектов
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
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          row.push(current.replace(/""/g, '"'));
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.replace(/""/g, '"'));
      
      if (row.length >= 3) {
        result.push({
          site: row[0],
          login: row[1],
          password: row[2],
          category: row[3] || ''
        });
      }
    }
    return result;
  };

  // Экспорт паролей с AES-256 шифрованием
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
      
      if (response.data.length === 0) {
        toast.error('Нет паролей для экспорта', { id: 'export' });
        return;
      }
      
      // Конвертируем в CSV
      const csvData = convertToCSV(response.data);
      
      // Шифруем AES-256
      const encrypted = CryptoJS.AES.encrypt(csvData, masterPassword).toString();
      
      // Сохраняем как .csv (но внутри зашифровано)
      const blob = new Blob([encrypted], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `passwords_${new Date().toISOString().slice(0, 19)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`Экспортировано ${response.data.length} паролей (AES-256)`, { id: 'export' });
    } catch (err) {
      console.error('Ошибка экспорта:', err);
      toast.error('Ошибка экспорта', { id: 'export' });
    }
  };

  // Импорт паролей с AES-256 расшифровкой
  const handleImport = (event) => {
    const file = event.target.files[0];
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
        
        // Расшифровываем AES-256
        let decrypted;
        try {
          const bytes = CryptoJS.AES.decrypt(fileContent, masterPassword);
          decrypted = bytes.toString(CryptoJS.enc.Utf8);
          
          if (!decrypted) {
            throw new Error('Расшифровка не удалась');
          }
        } catch (err) {
          toast.error('Неверный мастер-пароль или файл поврежден', { id: 'import' });
          return;
        }
        
        // Парсим CSV
        const importedPasswords = parseCSV(decrypted);
        
        if (importedPasswords.length === 0) {
          toast.error('Файл не содержит паролей', { id: 'import' });
          return;
        }
        
        // Получаем существующие пароли
        const existingResponse = await api.get('/passwords', {
          params: { master_password: masterPassword }
        });
        
        const existingPasswords = existingResponse.data;
        
        // Фильтруем дубликаты
        const newPasswords = importedPasswords.filter(imported => 
          !existingPasswords.some(existing => 
            existing.site === imported.site && existing.login === imported.login
          )
        );
        
        if (newPasswords.length === 0) {
          toast.error('Нет новых паролей для импорта (все дубликаты)', { id: 'import' });
          return;
        }
        
        let successCount = 0;
        for (const pwd of newPasswords) {
          try {
            await api.post('/passwords', {
              site: pwd.site,
              login: pwd.login,
              password: pwd.password,
              category: pwd.category || ''
            }, {
              params: { master_password: masterPassword }
            });
            successCount++;
          } catch (err) {
            console.error('Ошибка импорта пароля:', pwd.site);
          }
        }
        
        toast.success(`Импортировано ${successCount} новых паролей (пропущено дубликатов: ${importedPasswords.length - successCount})`, { id: 'import' });
        
        if (successCount > 0) {
          setTimeout(() => window.location.reload(), 1500);
        }
        
      } catch (err) {
        console.error('Ошибка импорта:', err);
        toast.error('Ошибка импорта', { id: 'import' });
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    try {
      await api.post('/settings', {
        twoFAEnabled,
        backupInterval,
        backupPath
      });
      toast.success('Настройки сохранены');
      onClose();
    } catch (err) {
      console.error('Ошибка сохранения настроек:', err);
      toast.error('Ошибка сохранения');
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
          </div>
          
          <div className="settings-section">
            <h3>Импорт/Экспорт</h3>
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
                📤 Экспорт (AES-256)
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
                📥 Импорт (AES-256)
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleImport}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
              Файлы зашифрованы AES-256. Требуется мастер-пароль для расшифровки.
            </p>
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