import React, { useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

function Login({ onLogin }) {
  const [masterPassword, setMasterPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [require2FA, setRequire2FA] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!masterPassword.trim()) {
      const message = 'Введите мастер-пароль';
      setError(message);
      toast.error(message);
      return;
    }

    if (require2FA && !twoFactorCode.trim()) {
      const message = 'Введите 6-значный код';
      setError(message);
      toast.error(message);
      return;
    }

    try {
      setIsSubmitting(true);

      if (!require2FA) {
        const response = await api.post('/auth/login', {
          master_password: masterPassword,
        });

        if (response.data.requires_2fa) {
          setRequire2FA(true);
          setTwoFactorCode('');
          toast.success('Код отправлен на почту');
        } else {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('masterPassword', masterPassword);
          toast.success('Добро пожаловать!');
          onLogin();
        }
      } else {
        const response = await api.post('/auth/verify-2fa', {
          master_password: masterPassword,
          two_factor_code: twoFactorCode.trim(),
        });

        localStorage.setItem('token', response.data.token);
        localStorage.setItem('masterPassword', masterPassword);
        toast.success('Вход выполнен успешно');
        onLogin();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Ошибка входа';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setRequire2FA(false);
    setTwoFactorCode('');
    setError('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Менеджер паролей</h1>
        <p>
          {require2FA
            ? 'Введите 6-значный код, отправленный на указанную в настройках почту'
            : 'Введите мастер-пароль для доступа'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Мастер-пароль</label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Введите мастер-пароль"
              required
              disabled={isSubmitting || require2FA}
            />
          </div>

          {require2FA && (
            <div className="form-group">
              <label>Код подтверждения</label>
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) =>
                  setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Введите 6-значный код"
                inputMode="numeric"
                maxLength={6}
                required
                disabled={isSubmitting}
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={isSubmitting}>
            {isSubmitting
              ? 'Подождите...'
              : require2FA
                ? 'Подтвердить'
                : 'Войти'}
          </button>

          {require2FA && (
            <button
              type="button"
              className="cancel-btn"
              onClick={handleBack}
              disabled={isSubmitting}
              style={{ width: '100%', marginTop: '0.75rem' }}
            >
              Назад
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default Login;