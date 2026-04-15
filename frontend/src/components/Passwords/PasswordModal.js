import React, { useState, useEffect } from 'react';
import PasswordStrength from '../Common/PasswordStrength';
import PasswordGenerator from './PasswordGenerator';

function PasswordModal({ isOpen, onClose, onSave, password, groups, onCreateGroup }) {
  const [formData, setFormData] = useState({
    site: '',
    login: '',
    password: '',
    group_id: ''
  });
  const [showGenerator, setShowGenerator] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    if (password) {
      setFormData({
        site: password.site || '',
        login: password.login || '',
        password: password.password || '',
        group_id: password.group_id ?? ''
      });
    } else {
      setFormData({ site: '', login: '', password: '', group_id: '' });
    }
  }, [password]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      site: formData.site,
      login: formData.login,
      password: formData.password,
      group_id: formData.group_id === '' ? null : Number(formData.group_id)
    });
  };

  const handleGeneratedPassword = (pwd) => {
    setFormData({ ...formData, password: pwd });
    setShowGenerator(false);
  };

  const handleCreateGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed || !onCreateGroup) return;

    setCreatingGroup(true);
    const created = await onCreateGroup(trimmed);
    setCreatingGroup(false);

    if (created) {
      setFormData((prev) => ({
        ...prev,
        group_id: created.id
      }));
      setNewGroupName('');
    }
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
              onChange={(e) => setFormData({ ...formData, site: e.target.value })}
              placeholder="google.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Логин *</label>
            <input
              type="text"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Пароль *</label>
            <div className="password-inline">
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Введите или сгенерируйте пароль"
                required
              />
              <button
                type="button"
                onClick={() => setShowGenerator(!showGenerator)}
                className="generator-toggle-btn"
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
            <label>Группа</label>
            <select
              value={formData.group_id}
              onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
            >
              <option value="">Без группы</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Создать новую группу</label>
            <div className="inline-row">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Например: Работа"
              />
              <button
                type="button"
                className="secondary-btn"
                onClick={handleCreateGroup}
                disabled={creatingGroup || !newGroupName.trim()}
              >
                {creatingGroup ? '...' : 'Создать'}
              </button>
            </div>
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