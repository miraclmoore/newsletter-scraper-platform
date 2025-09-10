const express = require('express');
const UserModel = require('../models/supabase/User');
const OAuthCredentialModel = require('../models/supabase/OAuthCredential');
const SourceModel = require('../models/supabase/Source');
const GoogleOAuthService = require('../services/oauth/googleService');
const MicrosoftOAuthService = require('../services/oauth/microsoftService');
const { 
  authenticateToken, 
  generateToken, 
  generateOAuthState, 
  verifyOAuthState 
} = require('../middleware/auth');
const { authLimiter, oauthLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

// Initialize OAuth services
const googleService = new GoogleOAuthService();
const microsoftService = new MicrosoftOAuthService();

/**
 * POST /auth/register - Register new user with email/password
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Create new user
    const user = await UserModel.create({
      email,
      password,
      firstName,
      lastName
    });

    // Generate JWT token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error during registration'
    });
  }
});

/**
 * POST /auth/login - Login with email/password
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // For users without password (OAuth-only), reject password login
    if (!user.passwordHash) {
      return res.status(401).json({
        error: 'Invalid login method',
        message: 'Please use OAuth to login (Google/Microsoft)'
      });
    }

    // Verify password
    const isValidPassword = await UserModel.validatePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Update last login
    await UserModel.update(user.id, { lastLoginAt: new Date() });

    // Generate JWT token
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error during login'
    });
  }
});

/**
 * GET /auth/google - Initiate Google OAuth flow
 */
router.get('/google', oauthLimiter, authenticateToken, async (req, res) => {
  try {
    const state = generateOAuthState(req.userId);
    const authUrl = googleService.getAuthUrl(state);
    
    res.json({
      authUrl,
      message: 'Redirect user to this URL to begin Google OAuth flow'
    });

  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    res.status(500).json({
      error: 'OAuth initiation failed',
      message: 'Failed to initiate Google OAuth flow'
    });
  }
});

/**
 * GET /auth/google/callback - Handle Google OAuth callback
 */
router.get('/google/callback', oauthLimiter, async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=oauth_cancelled`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=missing_parameters`);
    }

    // Verify state parameter
    const stateData = verifyOAuthState(state);
    const userId = stateData.userId;

    // Exchange code for tokens
    const tokenData = await googleService.getTokens(code);
    
    // Get user profile
    const profile = await googleService.getUserProfile(tokenData.access_token);

    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=user_not_found`);
    }

    // Store OAuth credentials using Supabase model
    await OAuthCredentialModel.upsert({
      userId: user.id,
      provider: 'gmail',
      providerUserId: profile.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: tokenData.expires_at,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      metadata: {
        email: profile.email,
        name: profile.name
      }
    });

    // Create or update source using Supabase model
    await SourceModel.upsert({
      userId: user.id,
      type: 'gmail',
      name: `Gmail - ${profile.email}`,
      configuration: {
        email: profile.email,
        connectedAt: new Date()
      },
      syncStatus: 'success',
      lastSyncAt: new Date()
    });

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?success=gmail_connected`);

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=oauth_failed`);
  }
});

/**
 * GET /auth/microsoft - Initiate Microsoft OAuth flow
 */
router.get('/microsoft', oauthLimiter, authenticateToken, async (req, res) => {
  try {
    const state = generateOAuthState(req.userId);
    const authUrl = await microsoftService.getAuthUrl(state);
    
    res.json({
      authUrl,
      message: 'Redirect user to this URL to begin Microsoft OAuth flow'
    });

  } catch (error) {
    console.error('Microsoft OAuth initiation error:', error);
    res.status(500).json({
      error: 'OAuth initiation failed',
      message: 'Failed to initiate Microsoft OAuth flow'
    });
  }
});

/**
 * GET /auth/microsoft/callback - Handle Microsoft OAuth callback
 */
router.get('/microsoft/callback', oauthLimiter, async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=oauth_cancelled`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=missing_parameters`);
    }

    // Verify state parameter
    const stateData = verifyOAuthState(state);
    const userId = stateData.userId;

    // Exchange code for tokens
    const tokenData = await microsoftService.getTokens(code);
    
    // Get user profile
    const profile = await microsoftService.getUserProfile(tokenData.access_token);

    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=user_not_found`);
    }

    // Store OAuth credentials using Supabase model
    await OAuthCredentialModel.upsert({
      userId: user.id,
      provider: 'outlook',
      providerUserId: profile.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: tokenData.expires_at,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      metadata: {
        email: profile.email,
        name: profile.name
      }
    });

    // Create or update source using Supabase model
    await SourceModel.upsert({
      userId: user.id,
      type: 'outlook',
      name: `Outlook - ${profile.email}`,
      configuration: {
        email: profile.email,
        connectedAt: new Date()
      },
      syncStatus: 'success',
      lastSyncAt: new Date()
    });

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?success=outlook_connected`);

  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=oauth_failed`);
  }
});

/**
 * GET /auth/sources - Get user's connected sources
 */
router.get('/sources', authenticateToken, async (req, res) => {
  try {
    const sources = await SourceModel.findByUser(req.userId);
    
    res.json({
      sources,
      count: sources.length
    });

  } catch (error) {
    console.error('Get sources error:', error);
    res.status(500).json({
      error: 'Failed to get sources',
      message: 'Internal server error while fetching sources'
    });
  }
});

/**
 * POST /auth/disconnect - Disconnect OAuth provider
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.body;

    if (!provider || !['gmail', 'outlook'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be gmail or outlook'
      });
    }

    // Find OAuth credential
    const credential = await OAuthCredentialModel.findByUserAndProvider(req.userId, provider);

    if (!credential) {
      return res.status(404).json({
        error: 'Connection not found',
        message: `No ${provider} connection found for this user`
      });
    }

    // Attempt to revoke token
    try {
      const accessToken = credential.getAccessToken();
      if (provider === 'gmail') {
        await googleService.revokeAccess(accessToken);
      } else {
        await microsoftService.revokeAccess(accessToken);
      }
    } catch (revokeError) {
      console.warn(`Failed to revoke ${provider} token:`, revokeError);
      // Continue with local cleanup even if remote revoke fails
    }

    // Remove credential and source using Supabase models
    await OAuthCredentialModel.delete(credential.id);
    
    const source = await SourceModel.findByUserAndType(req.userId, provider);
    if (source) {
      await SourceModel.delete(source.id);
    }

    res.json({
      message: `${provider} account disconnected successfully`
    });

  } catch (error) {
    console.error('OAuth disconnect error:', error);
    res.status(500).json({
      error: 'Disconnect failed',
      message: 'Failed to disconnect OAuth provider'
    });
  }
});

module.exports = router;