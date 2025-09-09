const sequelize = require('../config/database');
const User = require('./User');
const OAuthCredential = require('./OAuthCredential');
const Source = require('./Source');

// Define associations
User.hasMany(OAuthCredential, { 
  foreignKey: 'userId', 
  as: 'oauthCredentials',
  onDelete: 'CASCADE'
});

User.hasMany(Source, { 
  foreignKey: 'userId', 
  as: 'sources',
  onDelete: 'CASCADE'
});

OAuthCredential.belongsTo(User, { 
  foreignKey: 'userId', 
  as: 'user' 
});

Source.belongsTo(User, { 
  foreignKey: 'userId', 
  as: 'user' 
});

// Export models and sequelize instance
module.exports = {
  sequelize,
  User,
  OAuthCredential,
  Source,
};

// Initialize database connection
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Sync models in development
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database models synchronized.');
    }
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
}

module.exports.initializeDatabase = initializeDatabase;