const { google } = require('googleapis');
const { google: googleConfig } = require('../../config/oauth');

class GoogleOAuthService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret,
      googleConfig.redirectUri
    );
  }

  /**
   * Generate OAuth2 authorization URL
   * @param {string} state - State parameter for security
   * @returns {string} Authorization URL
   */
  getAuthUrl(state) {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: googleConfig.scopes,
      state: state,
      prompt: 'consent'
    });
    
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from Google
   * @returns {Object} Token information
   */
  async getTokens(code) {
    try {
      const { tokens } = await this.oauth2Client.getAccessToken(code);
      
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + (tokens.expiry_date || 3600000)),
        scope: tokens.scope
      };
    } catch (error) {
      throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New token information
   */
  async refreshAccessToken(refreshToken) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      return {
        access_token: credentials.access_token,
        expires_at: new Date(credentials.expiry_date),
        refresh_token: credentials.refresh_token || refreshToken // Keep original if not provided
      };
    } catch (error) {
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }

  /**
   * Get user profile information
   * @param {string} accessToken - Access token
   * @returns {Object} User profile
   */
  async getUserProfile(accessToken) {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();
      
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        firstName: data.given_name,
        lastName: data.family_name,
        picture: data.picture,
        verified_email: data.verified_email
      };
    } catch (error) {
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }

  /**
   * Test API access with current token
   * @param {string} accessToken - Access token
   * @returns {boolean} Whether access is valid
   */
  async testApiAccess(accessToken) {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      await gmail.users.getProfile({ userId: 'me' });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke token access
   * @param {string} token - Token to revoke
   * @returns {boolean} Success status
   */
  async revokeAccess(token) {
    try {
      await this.oauth2Client.revokeToken(token);
      return true;
    } catch (error) {
      console.error('Failed to revoke Google token:', error);
      return false;
    }
  }
}

module.exports = GoogleOAuthService;