import React, { useState, useEffect } from 'react';
import PasswordStrength from '../Common/PasswordStrength';
import PasswordGenerator from './PasswordGenerator';

function PasswordModal({ isOpen, onClose, onSave, password }) {
  const [formData, setFormData] = useState({
    site: '',
    login: '',
    password: '',
    category: ''
  });
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    if (password) {
      setFormData(password);
    } else {
      setFormData({ site: '', login: '', password: '', category: '' });
    }
  }, [password]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleGeneratedPassword = (pwd) => {
    setFormData({ ...formData, password: pwd });
    setShowGenerator(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{password ? 'Редактировать пароль' : 'Добавить пароль'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Сайт *</label>
            <input
              type="text"
              value={formData.site}
              onChange={(e) => setFormData({...formData, site: e.target.value})}
              placeholder="google.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Логин *</label>
            <input
              type="text"
              value={formData.login}
              onChange={(e) => setFormData({...formData, login: e.target.value})}
              placeholder="user@example.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Пароль *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Введите или сгенерируйте пароль"
                required
                style={{ flex: 1 }}
              />
              <button 
                type="button" 
                onClick={() => setShowGenerator(!showGenerator)}
                style={{ padding: '0 12px', cursor: 'pointer' }}
              >
                Ген
              </button>
            </div>
            <PasswordStrength password={formData.password} />
          </div>
          
          {showGenerator && (
            <div style={{ marginTop: '10px' }}>
              <PasswordGenerator onGenerate={handleGeneratedPassword} />
            </div>
          )}
          
          <div className="form-group">
            <label>Категория</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              placeholder="Работа, Личное, Соцсети..."
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Отмена</button>
            <button type="submit" className="save-btn">
              {password ? 'Сохранить' : 'Добавить пароль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordModal;