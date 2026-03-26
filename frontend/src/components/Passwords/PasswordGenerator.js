import React, { useState } from 'react';

function PasswordGenerator({ onGenerate }) {
  const [options, setOptions] = useState({
    length: 12,
    useDigits: true,
    useUppercase: true,
    useLowercase: true,
    useSpecial: false,
  });
  const [generatedPassword, setGeneratedPassword] = useState('');

  const generate = () => {
    let chars = '';
    if (options.useLowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (options.useUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (options.useDigits) chars += '0123456789';
    if (options.useSpecial) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';
    
    let password = '';
    for (let i = 0; i < options.length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    
    setGeneratedPassword(password);
    if (onGenerate) onGenerate(password);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword);
    alert('Пароль скопирован в буфер обмена');
  };

  return (
    <div className="generator-modal">
      <h4>Создание случайного пароля</h4>
      
      <div className="generator-options">
        <div className="option">
          <label>Длина: {options.length}</label>
          <input
            type="range"
            min="4"
            max="32"
            value={options.length}
            onChange={(e) => setOptions({...options, length: parseInt(e.target.value)})}
          />
        </div>
        
        <div className="option">
          <label>
            <input
              type="checkbox"
              checked={options.useDigits}
              onChange={(e) => setOptions({...options, useDigits: e.target.checked})}
            />
            Цифры
          </label>
        </div>
        
        <div className="option">
          <label>
            <input
              type="checkbox"
              checked={options.useUppercase}
              onChange={(e) => setOptions({...options, useUppercase: e.target.checked})}
            />
            Заглавные буквы
          </label>
        </div>
        
        <div className="option">
          <label>
            <input
              type="checkbox"
              checked={options.useLowercase}
              onChange={(e) => setOptions({...options, useLowercase: e.target.checked})}
            />
            Строчные буквы
          </label>
        </div>
        
        <div className="option">
          <label>
            <input
              type="checkbox"
              checked={options.useSpecial}
              onChange={(e) => setOptions({...options, useSpecial: e.target.checked})}
            />
            Специальные символы
          </label>
        </div>
        
        <button onClick={generate} className="generate-btn">Сгенерировать</button>
        
        {generatedPassword && (
          <div className="generated-password">
            <p><strong>Сгенерированный пароль:</strong></p>
            <div 
              style={{ 
                background: '#f0f0f0', 
                padding: '8px', 
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                textAlign: 'center'
              }} 
              onClick={copyToClipboard}
            >
              {generatedPassword}
              <span style={{ fontSize: '12px', display: 'block', color: '#666' }}>
                📋 Нажмите чтобы скопировать
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PasswordGenerator;
