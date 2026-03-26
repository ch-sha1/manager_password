import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import PasswordCard from './PasswordCard';
import PasswordModal from './PasswordModal';
import SearchBar from '../Common/SearchBar';

function PasswordList() {
  const [passwords, setPasswords] = useState([]);
  const [filteredPasswords, setFilteredPasswords] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadPasswords();
  }, []);

  const loadPasswords = async () => {
    try {
      const masterPassword = prompt('Введите мастер-пароль для расшифровки:');
      if (!masterPassword) return;
      
      const response = await api.get('/passwords', {
        params: { master_password: masterPassword }
      });
      setPasswords(response.data);
      setFilteredPasswords(response.data);
      const uniqueCategories = [...new Set(response.data.map(p => p.category).filter(c => c))];
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('Ошибка загрузки паролей:', err);
      alert('Ошибка загрузки паролей: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSearch = (query) => {
    if (!query) {
      setFilteredPasswords(passwords);
      return;
    }
    const filtered = passwords.filter(p => 
      p.site.toLowerCase().includes(query.toLowerCase()) ||
      p.login.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredPasswords(filtered);
  };

  const handleAdd = () => {
    setEditingPassword(null);
    setIsModalOpen(true);
  };

  const handleEdit = (password) => {
    setEditingPassword(password);
    setIsModalOpen(true);
  };

  const handleSave = async (passwordData) => {
    try {
      const masterPassword = prompt('Введите мастер-пароль для шифрования:');
      if (!masterPassword) return;
      
      if (editingPassword) {
        // Редактирование
        await api.put(`/passwords/${editingPassword.id}`, passwordData, {
          params: { master_password: masterPassword }
        });
        alert('Пароль успешно обновлен');
      } else {
        // Добавление
        await api.post('/passwords', passwordData, {
          params: { master_password: masterPassword }
        });
        alert('Пароль успешно добавлен');
      }
      loadPasswords();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      alert('Ошибка сохранения пароля: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Удалить этот пароль?')) {
      try {
        await api.delete(`/passwords/${id}`);
        loadPasswords();
        alert('Пароль удален');
      } catch (err) {
        console.error('Ошибка удаления:', err);
        alert('Ошибка удаления: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleShare = (password) => {
    const shareLink = `${window.location.origin}/share/${password.id}`;
    navigator.clipboard.writeText(shareLink);
    alert('Ссылка для доступа скопирована!');
  };

  const filterByCategory = (category) => {
    if (!category) {
      setFilteredPasswords(passwords);
    } else {
      setFilteredPasswords(passwords.filter(p => p.category === category));
    }
  };

  return (
    <div className="password-list">
      <div className="list-header">
        <h2>Мои пароли</h2>
        <button onClick={handleAdd} className="add-btn">+ Добавить</button>
      </div>
      
      <SearchBar onSearch={handleSearch} />
      
      <div className="categories-bar">
        <button 
          className="categories-toggle"
          onClick={() => setShowCategories(!showCategories)}
        >
          Каталоги {showCategories ? '▼' : '▶'}
        </button>
        
        {showCategories && (
          <div className="categories-list">
            <button onClick={() => filterByCategory(null)}>Все</button>
            {categories.map(cat => (
              <button key={cat} onClick={() => filterByCategory(cat)}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="passwords-grid">
        {filteredPasswords.map(pwd => (
          <PasswordCard
            key={pwd.id}
            password={pwd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onShare={handleShare}
          />
        ))}
      </div>
      
      <PasswordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        password={editingPassword}
      />
    </div>
  );
}

export default PasswordList;
