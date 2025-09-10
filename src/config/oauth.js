require('dotenv').config();

module.exports = {
  google: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
  },
  microsoft: {
    clientId: process.env.OUTLOOK_CLIENT_ID,
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
    redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3000/auth/microsoft/callback',
    scopes: [
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/User.Read'
    ],
    authority: 'https://login.microsoftonline.com/common'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-key',
    expiresIn: '24h'
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'
  }
};