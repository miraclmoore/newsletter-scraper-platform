const GoogleOAuthService = require('../googleService');

// Mock the googleapis library
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/oauth/authorize?mock=true'),
        getAccessToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            expiry_date: Date.now() + 3600000,
            scope: 'https://www.googleapis.com/auth/gmail.readonly'
          }
        }),
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new_access_token',
            expiry_date: Date.now() + 3600000
          }
        }),
        revokeToken: jest.fn().mockResolvedValue(true)
      }))
    },
    oauth2: jest.fn().mockReturnValue({
      userinfo: {
        get: jest.fn().mockResolvedValue({
          data: {
            id: 'mock_user_id',
            email: 'test@gmail.com',
            name: 'Test User',
            given_name: 'Test',
            family_name: 'User',
            picture: 'https://example.com/picture.jpg',
            verified_email: true
          }
        })
      }
    }),
    gmail: jest.fn().mockReturnValue({
      users: {
        getProfile: jest.fn().mockResolvedValue({
          data: { emailAddress: 'test@gmail.com' }
        })
      }
    })
  }
}));

describe('GoogleOAuthService', () => {
  let service;

  beforeEach(() => {
    service = new GoogleOAuthService();
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    test('should generate authorization URL', () => {
      const state = 'test_state';
      const authUrl = service.getAuthUrl(state);
      
      expect(authUrl).toBe('https://accounts.google.com/oauth/authorize?mock=true');
      expect(service.oauth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: expect.any(Array),
        state: state,
        prompt: 'consent'
      });
    });
  });

  describe('getTokens', () => {
    test('should exchange authorization code for tokens', async () => {
      const code = 'test_auth_code';
      const tokens = await service.getTokens(code);
      
      expect(tokens).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: expect.any(Date),
        scope: 'https://www.googleapis.com/auth/gmail.readonly'
      });
      
      expect(service.oauth2Client.getAccessToken).toHaveBeenCalledWith(code);
    });

    test('should handle token exchange errors', async () => {
      service.oauth2Client.getAccessToken.mockRejectedValueOnce(new Error('Invalid code'));
      
      await expect(service.getTokens('invalid_code')).rejects.toThrow('Failed to exchange code for tokens');
    });
  });

  describe('refreshAccessToken', () => {
    test('should refresh access token', async () => {
      const refreshToken = 'test_refresh_token';
      const result = await service.refreshAccessToken(refreshToken);
      
      expect(result).toEqual({
        access_token: 'new_access_token',
        expires_at: expect.any(Date),
        refresh_token: refreshToken
      });
      
      expect(service.oauth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: refreshToken
      });
    });

    test('should handle refresh errors', async () => {
      service.oauth2Client.refreshAccessToken.mockRejectedValueOnce(new Error('Invalid refresh token'));
      
      await expect(service.refreshAccessToken('invalid_token')).rejects.toThrow('Failed to refresh access token');
    });
  });

  describe('getUserProfile', () => {
    test('should get user profile', async () => {
      const accessToken = 'test_access_token';
      const profile = await service.getUserProfile(accessToken);
      
      expect(profile).toEqual({
        id: 'mock_user_id',
        email: 'test@gmail.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        picture: 'https://example.com/picture.jpg',
        verified_email: true
      });
      
      expect(service.oauth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: accessToken
      });
    });

    test('should handle profile fetch errors', async () => {
      const mockOauth2 = require('googleapis').google.oauth2();
      mockOauth2.userinfo.get.mockRejectedValueOnce(new Error('API error'));
      
      await expect(service.getUserProfile('invalid_token')).rejects.toThrow('Failed to get user profile');
    });
  });

  describe('testApiAccess', () => {
    test('should return true for valid access', async () => {
      const accessToken = 'valid_access_token';
      const result = await service.testApiAccess(accessToken);
      
      expect(result).toBe(true);
    });

    test('should return false for invalid access', async () => {
      const mockGmail = require('googleapis').google.gmail();
      mockGmail.users.getProfile.mockRejectedValueOnce(new Error('Unauthorized'));
      
      const result = await service.testApiAccess('invalid_token');
      expect(result).toBe(false);
    });
  });

  describe('revokeAccess', () => {
    test('should revoke token access', async () => {
      const token = 'test_token';
      const result = await service.revokeAccess(token);
      
      expect(result).toBe(true);
      expect(service.oauth2Client.revokeToken).toHaveBeenCalledWith(token);
    });

    test('should handle revoke errors gracefully', async () => {
      service.oauth2Client.revokeToken.mockRejectedValueOnce(new Error('Revoke failed'));
      
      const result = await service.revokeAccess('test_token');
      expect(result).toBe(false);
    });
  });
});