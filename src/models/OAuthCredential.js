const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');
const { encryption } = require('../config/oauth');

const OAuthCredential = sequelize.define('OAuthCredential', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  provider: {
    type: DataTypes.ENUM('gmail', 'outlook'),
    allowNull: false,
  },
  providerUserId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  encryptedAccessToken: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  encryptedRefreshToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  scopes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'oauth_credentials',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['provider'] },
    { fields: ['userId', 'provider'], unique: true },
    { fields: ['providerUserId'] },
  ],
});

// Encryption/Decryption methods
OAuthCredential.prototype.setAccessToken = function(token) {
  this.encryptedAccessToken = encrypt(token);
};

OAuthCredential.prototype.getAccessToken = function() {
  return decrypt(this.encryptedAccessToken);
};

OAuthCredential.prototype.setRefreshToken = function(token) {
  this.encryptedRefreshToken = token ? encrypt(token) : null;
};

OAuthCredential.prototype.getRefreshToken = function() {
  return this.encryptedRefreshToken ? decrypt(this.encryptedRefreshToken) : null;
};

OAuthCredential.prototype.isTokenExpired = function() {
  if (!this.tokenExpiresAt) return false;
  return new Date() >= this.tokenExpiresAt;
};

// Encryption utilities
function encrypt(text) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(encryption.key, 'utf8');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  cipher.setAAD(Buffer.from('oauth-token', 'utf8'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted: encrypted,
    authTag: authTag.toString('hex')
  });
}

function decrypt(encryptedData) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(encryption.key, 'utf8');
  
  const data = JSON.parse(encryptedData);
  const iv = Buffer.from(data.iv, 'hex');
  const authTag = Buffer.from(data.authTag, 'hex');
  
  const decipher = crypto.createDecipher(algorithm, key);
  decipher.setAAD(Buffer.from('oauth-token', 'utf8'));
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = OAuthCredential;