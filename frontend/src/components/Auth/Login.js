import React, { useState } from 'react';
import api from '../../services/api';

function Login({ onLogin }) {
  const [masterPassword, setMasterPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [require2FA, setRequire2FA] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');

  try {
    if (!require2FA) {
      const response = await api.post('/auth/login', {
        master_password: masterPassword,
      });
      
      if (response.data.requires_2fa) {
        setRequire2FA(true);
      } else {
        // СОХРАНЯЕМ ТОКЕН И МАСТЕР-ПАРОЛЬ
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('masterPassword', masterPassword);  // ← ЭТО ВАЖНО!
        onLogin();
      }
    } else {
      const response = await api.post('/auth/verify-2fa', {
        master_password: masterPassword,
        two_factor_code: twoFactorCode,
      });
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('masterPassword', masterPassword);  // ← И ТУТ ТОЖЕ
      onLogin();
    }
  } catch (err) {
    setError(err.response?.data?.detail || 'Ошибка входа');
  }
};
  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Менеджер паролей</h1>
        <p>Введите мастер-пароль для доступа</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Мастер-пароль</label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Введите мастер-пароль"
              required
            />
          </div>
          
          {require2FA && (
            <div className="form-group">
              <label>Код 2FA</label>
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="Введите код из приложения"
                required
              />
            </div>
          )}
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="login-btn">
            {require2FA ? 'Подтвердить' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
