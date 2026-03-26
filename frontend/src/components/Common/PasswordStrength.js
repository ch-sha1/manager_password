import React from 'react';

function PasswordStrength({ password }) {
  const calculateStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'Не введен', color: '#e2e8f0' };
    
    let score = 0;
    
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;
    
    if (score <= 2) return { score, label: 'Слабый', color: '#f56565' };
    if (score <= 4) return { score, label: 'Средний', color: '#ed8936' };
    return { score, label: 'Надёжный', color: '#48bb78' };
  };
  
  const strength = calculateStrength(password);
  
  return (
    <div style={{ marginTop: '5px' }}>
      <div style={{ 
        height: '4px', 
        background: '#e2e8f0', 
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{ 
          width: `${(strength.score / 6) * 100}%`,
          height: '100%',
          backgroundColor: strength.color,
          transition: 'width 0.3s'
        }} />
      </div>
      <span style={{ fontSize: '12px', color: strength.color }}>
        {strength.label}
      </span>
    </div>
  );
}

export default PasswordStrength;
