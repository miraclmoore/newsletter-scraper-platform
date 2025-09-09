const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Source = sequelize.define('Source', {
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
  type: {
    type: DataTypes.ENUM('gmail', 'outlook', 'rss', 'forwarding'),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  configuration: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  syncStatus: {
    type: DataTypes.ENUM('pending', 'syncing', 'success', 'error'),
    defaultValue: 'pending',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  itemCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'sources',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['type'] },
    { fields: ['userId', 'type'] },
    { fields: ['isActive'] },
    { fields: ['lastSyncAt'] },
  ],
});

module.exports = Source;