const rateLimit = require('express-rate-limit');

// General API rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many login attempts, please try again later.',
    retryAfter: 900 // 15 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict rate limiting for OAuth endpoints
const oauthLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 OAuth attempts per window
  message: {
    error: 'Too many OAuth attempts',
    message: 'Too many OAuth attempts, please try again later.',
    retryAfter: 300 // 5 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Gmail API specific rate limiting
const gmailApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 250, // Gmail API quota: 250 units per user per second (being conservative)
  message: {
    error: 'Gmail API rate limit exceeded',
    message: 'Too many Gmail API requests, please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Microsoft Graph API specific rate limiting
const graphApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // Microsoft Graph throttling varies, being conservative
  message: {
    error: 'Microsoft Graph API rate limit exceeded',
    message: 'Too many Microsoft Graph API requests, please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export rate limiting middleware
module.exports = {
  generalLimiter,
  authLimiter,
  oauthLimiter,
  gmailApiLimiter,
  graphApiLimiter,
};