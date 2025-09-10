const jwt = require('jsonwebtoken');
const UserModel = require('../models/supabase/User');
const { jwt: jwtConfig } = require('../config/oauth');

/**
 * Verify JWT token and authenticate user
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Authorization header with Bearer token is required'
      });
    }

    const decoded = jwt.verify(token, jwtConfig.secret);
    
    // Fetch user from database using Supabase model
    const user = await UserModel.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User not found'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token is malformed or invalid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Token has expired, please login again'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Optional authentication - continues even if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, jwtConfig.secret);
      const user = await UserModel.findById(decoded.userId);
      
      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    }
    
    next();
  } catch (error) {
    // Ignore errors in optional auth, just continue without user
    next();
  }
};

/**
 * Generate JWT token for user
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
};

/**
 * Generate a secure state parameter for OAuth flows
 */
const generateOAuthState = (userId) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const payload = { userId, timestamp, random };
  
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: '10m' });
};

/**
 * Verify OAuth state parameter
 */
const verifyOAuthState = (state) => {
  try {
    const decoded = jwt.verify(state, jwtConfig.secret);
    
    // Check if state is not too old (max 10 minutes)
    const now = Date.now();
    const stateAge = now - decoded.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    if (stateAge > maxAge) {
      throw new Error('OAuth state has expired');
    }
    
    return decoded;
  } catch (error) {
    throw new Error(`Invalid OAuth state: ${error.message}`);
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  generateOAuthState,
  verifyOAuthState,
};