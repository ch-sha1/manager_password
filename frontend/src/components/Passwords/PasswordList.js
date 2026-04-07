import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import PasswordCard from './PasswordCard';
import PasswordModal from './PasswordModal';
import SearchBar from '../Common/SearchBar';
import ConfirmModal from '../Common/ConfirmModal';

const PasswordList = forwardRef((props, ref) => {
  const [passwords, setPasswords] = useState([]);
  const [filteredPasswords, setFilteredPasswords] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordToDelete, setPasswordToDelete] = useState(null);

  const getMasterPassword = () => {
    const mp = localStorage.getItem('masterPassword');
    if (!mp) {
      toast.error('Сессия истекла, пожалуйста, войдите снова');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    }
    return mp;
  };

  const loadPasswords = async () => {
    try {
      const masterPassword = getMasterPassword();
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
      toast.error('Ошибка загрузки паролей');
    }
  };

  // Делаем loadPasswords доступной через ref
  useImperativeHandle(ref, () => ({
    loadPasswords
  }));

  useEffect(() => {
    loadPasswords();
  }, []);

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
      const masterPassword = getMasterPassword();
      if (!masterPassword) return;
      
      if (editingPassword) {
        await api.put(`/passwords/${editingPassword.id}`, passwordData, {
          params: { master_password: masterPassword }
        });
        toast.success('Пароль обновлен');
      } else {
        await api.post('/passwords', passwordData, {
          params: { master_password: masterPassword }
        });
        toast.success('Пароль добавлен');
      }
      loadPasswords();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      toast.error('Ошибка сохранения пароля');
    }
  };

  const handleDeleteClick = (id) => {
    setPasswordToDelete(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      const masterPassword = getMasterPassword();
      if (!masterPassword) return;
      
      await api.delete(`/passwords/${passwordToDelete}`);
      loadPasswords();
      toast.success('Пароль удален');
      setShowConfirm(false);
      setPasswordToDelete(null);
    } catch (err) {
      console.error('Ошибка удаления:', err);
      toast.error('Ошибка удаления');
    }
  };

  const handleShare = (password) => {
    const shareLink = `${window.location.origin}/share/${password.id}`;
    navigator.clipboard.writeText(shareLink);
    toast.success('Ссылка для доступа скопирована');
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
            onDelete={handleDeleteClick}
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

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPasswordToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Удаление пароля"
        message="Вы уверены, что хотите удалить этот пароль?"
      />
    </div>
  );
});

export default PasswordList;