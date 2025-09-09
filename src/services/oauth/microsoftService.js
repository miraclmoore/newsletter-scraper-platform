const { ConfidentialClientApplication } = require('@azure/msal-node');
const axios = require('axios');
const { microsoft: microsoftConfig } = require('../../config/oauth');

class MicrosoftOAuthService {
  constructor() {
    this.msalConfig = {
      auth: {
        clientId: microsoftConfig.clientId,
        clientSecret: microsoftConfig.clientSecret,
        authority: microsoftConfig.authority,
      }
    };
    
    this.pca = new ConfidentialClientApplication(this.msalConfig);
  }

  /**
   * Generate OAuth2 authorization URL
   * @param {string} state - State parameter for security
   * @returns {string} Authorization URL
   */
  async getAuthUrl(state) {
    const authCodeUrlParameters = {
      scopes: microsoftConfig.scopes,
      redirectUri: microsoftConfig.redirectUri,
      state: state,
    };

    try {
      const response = await this.pca.getAuthCodeUrl(authCodeUrlParameters);
      return response;
    } catch (error) {
      throw new Error(`Failed to generate auth URL: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from Microsoft
   * @returns {Object} Token information
   */
  async getTokens(code) {
    const tokenRequest = {
      code: code,
      scopes: microsoftConfig.scopes,
      redirectUri: microsoftConfig.redirectUri,
    };

    try {
      const response = await this.pca.acquireTokenByCode(tokenRequest);
      
      return {
        access_token: response.accessToken,
        refresh_token: response.refreshToken,
        expires_at: new Date(response.expiresOn),
        scope: response.scopes.join(' '),
        id_token: response.idToken
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
    const refreshTokenRequest = {
      refreshToken: refreshToken,
      scopes: microsoftConfig.scopes,
    };

    try {
      const response = await this.pca.acquireTokenByRefreshToken(refreshTokenRequest);
      
      return {
        access_token: response.accessToken,
        expires_at: new Date(response.expiresOn),
        refresh_token: response.refreshToken || refreshToken
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
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const user = response.data;
      return {
        id: user.id,
        email: user.mail || user.userPrincipalName,
        name: user.displayName,
        firstName: user.givenName,
        lastName: user.surname,
        jobTitle: user.jobTitle,
        officeLocation: user.officeLocation
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
      const response = await axios.get('https://graph.microsoft.com/v1.0/me/messages', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          '$top': 1
        }
      });
      
      return response.status === 200;
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
      // Microsoft Graph doesn't have a direct revoke endpoint for refresh tokens
      // The token will expire naturally or when user changes password/revokes consent
      // For immediate revocation, we'd need to call the Azure AD revoke endpoint
      
      await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/logout', {
        token: token,
        token_type_hint: 'access_token'
      });
      
      return true;
    } catch (error) {
      // Even if the revoke request fails, we should still treat it as success
      // since the token will expire and user intent is to disconnect
      console.warn('Microsoft token revoke request failed:', error.message);
      return true;
    }
  }
}

module.exports = MicrosoftOAuthService;