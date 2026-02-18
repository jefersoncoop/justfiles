const crypto = require('crypto');

// ========================================================
// UTILIDADES DE SEGURANÇA
// ========================================================

/**
 * Validar email
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validar senha forte
 * Requisitos: min 8 chars, 1 maiúscula, 1 minúscula, 1 número
 */
const validatePassword = (password) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.{8,})/;
  return passwordRegex.test(password);
};

/**
 * Gerar chave de encriptação a partir de senha
 */
const deriveKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
};

/**
 * Encriptar dados sensíveis
 */
const encryptData = (text, encryptionKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Descriptografar dados sensíveis
 */
const decryptData = (encryptedText, encryptionKey) => {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Sanitizar entrada para prevenir injeção
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>'"]/g, (char) => {
      const entities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
      };
      return entities[char];
    })
    .trim();
};

/**
 * Gerar token CSRF
 */
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Validar força de senha
 */
const getPasswordStrength = (password) => {
  let strength = 0;
  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 20;
  if (/[a-z]/.test(password)) strength += 20;
  if (/[A-Z]/.test(password)) strength += 20;
  if (/\d/.test(password)) strength += 20;
  return Math.min(strength, 100);
};

module.exports = {
  validateEmail,
  validatePassword,
  deriveKey,
  encryptData,
  decryptData,
  sanitizeInput,
  generateCSRFToken,
  getPasswordStrength
};
