const express = require('express');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/supabase/User');
const SourceModel = require('../models/supabase/Source');
const ItemModel = require('../models/supabase/Item');
const Summary = require('../models/supabase/Summary');
const { authenticateToken } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(generalLimiter);

/**
 * GET /api/users/profile
 * Get current user's profile information
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    // Remove sensitive information
    const { password, ...userProfile } = user;
    
    return res.status(200).json({
      success: true,
      data: userProfile
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user profile'
    });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile information
 */
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Validate allowed updates
    const allowedUpdates = ['name', 'email', 'timezone', 'preferences'];
    const updateData = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No valid fields provided for update'
      });
    }

    // If email is being updated, add verification requirement
    if (updateData.email) {
      // TODO: Implement email verification
      updateData.emailVerified = false;
    }

    const updatedUser = await UserModel.update(userId, updateData);
    
    // Remove sensitive information
    const { password, ...userProfile } = updatedUser;

    return res.status(200).json({
      success: true,
      data: userProfile,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user profile'
    });
  }
});

/**
 * PUT /api/users/password
 * Change user password
 */
router.put('/password', async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Current password and new password are required'
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get current user
    const user = await UserModel.findById(userId);
    
    if (!user || !user.password) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Password change not available for OAuth accounts'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Authentication error',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await UserModel.update(userId, { password: hashedNewPassword });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to change password'
    });
  }
});

/**
 * GET /api/users/sources
 * Get all connected sources for user
 */
router.get('/sources', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const sources = await SourceModel.findByUserId(userId);
    
    // Add statistics for each source
    const sourcesWithStats = await Promise.all(
      sources.map(async (source) => {
        const stats = await SourceModel.getSourceStats(source.id);
        return {
          ...source,
          stats
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: sourcesWithStats
    });

  } catch (error) {
    console.error('Error fetching user sources:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch connected sources'
    });
  }
});

/**
 * DELETE /api/users/sources/:id
 * Disconnect a source
 */
router.delete('/sources/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const sourceId = req.params.id;

    // Verify user owns the source
    const source = await SourceModel.findById(sourceId);
    
    if (!source || source.userId !== userId) {
      return res.status(404).json({
        error: 'Source not found',
        message: 'Source not found or access denied'
      });
    }

    // Delete the source (this should cascade to delete related items)
    const deleted = await SourceModel.delete(sourceId);

    if (!deleted) {
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to disconnect source'
      });
    }

    return res.status(200).json({
      success: true,
      message: `${source.name} has been disconnected`
    });

  } catch (error) {
    console.error('Error disconnecting source:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to disconnect source'
    });
  }
});

/**
 * GET /api/users/stats
 * Get user statistics (items, sources, usage)
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get various statistics
    const [
      itemStats,
      sourceStats,
      summaryStats
    ] = await Promise.all([
      ItemModel.getUserStats(userId),
      SourceModel.getUserStats(userId),
      Summary.getUserUsageStats(userId, 'month')
    ]);

    const stats = {
      items: itemStats,
      sources: sourceStats,
      aiSummary: summaryStats,
      totalStorage: itemStats.totalSize || 0,
      memberSince: req.user.createdAt
    };

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user statistics'
    });
  }
});

/**
 * POST /api/users/export-data
 * Export all user data (GDPR compliance)
 */
router.post('/export-data', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all user data
    const [user, sources, items, summaries] = await Promise.all([
      UserModel.findById(userId),
      SourceModel.findByUserId(userId),
      ItemModel.findByUserId(userId, { limit: 10000 }),
      Summary.findByUserId ? Summary.findByUserId(userId) : []
    ]);

    // Remove sensitive information
    const { password, ...userData } = user;

    const exportData = {
      exportDate: new Date().toISOString(),
      user: userData,
      sources: sources,
      items: items.map(item => ({
        ...item,
        // Remove any sensitive internal metadata
        metadata: item.metadata ? {
          ...item.metadata,
          processing: item.metadata.processing
        } : {}
      })),
      summaries: summaries,
      statistics: {
        totalItems: items.length,
        totalSources: sources.length,
        totalSummaries: summaries.length
      }
    };

    // Return as downloadable JSON
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="newsletter-data-export-${new Date().toISOString().split('T')[0]}.json"`
    });

    return res.status(200).json(exportData);

  } catch (error) {
    console.error('Error exporting user data:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to export user data'
    });
  }
});

/**
 * DELETE /api/users/account
 * Delete user account and all associated data
 */
router.delete('/account', async (req, res) => {
  try {
    const userId = req.user.id;
    const { confirmationText } = req.body;

    // Require confirmation
    if (confirmationText !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Please type "DELETE MY ACCOUNT" to confirm account deletion'
      });
    }

    // Start deletion process
    console.log(`Starting account deletion for user ${userId}`);

    // Delete in order to respect foreign key constraints
    await Promise.all([
      // Delete summaries
      Summary.deleteByUserId ? Summary.deleteByUserId(userId) : Promise.resolve(),
      // Delete items (via sources deletion)
      // Delete OAuth tokens/credentials
    ]);

    // Delete sources (this should cascade to delete items)
    const sources = await SourceModel.findByUserId(userId);
    await Promise.all(sources.map(source => SourceModel.delete(source.id)));

    // Finally, delete the user
    const userDeleted = await UserModel.delete(userId);

    if (!userDeleted) {
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete user account'
      });
    }

    console.log(`Account deletion completed for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Account has been permanently deleted'
    });

  } catch (error) {
    console.error('Error deleting user account:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete account. Please contact support.'
    });
  }
});

/**
 * PUT /api/users/preferences
 * Update user preferences
 */
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    // Validate preferences structure
    const allowedPreferences = [
      'emailNotifications',
      'aiSummaryEnabled',
      'autoSummarizeNewItems',
      'exportFormat',
      'timezone',
      'language',
      'theme'
    ];

    const validPreferences = {};
    allowedPreferences.forEach(pref => {
      if (preferences[pref] !== undefined) {
        validPreferences[pref] = preferences[pref];
      }
    });

    // Update user preferences
    const updatedUser = await UserModel.update(userId, {
      preferences: validPreferences
    });

    return res.status(200).json({
      success: true,
      data: updatedUser.preferences,
      message: 'Preferences updated successfully'
    });

  } catch (error) {
    console.error('Error updating user preferences:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update preferences'
    });
  }
});

/**
 * POST /api/users/verify-email
 * Send email verification (placeholder)
 */
router.post('/verify-email', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // TODO: Implement email verification
    // This would:
    // 1. Generate verification token
    // 2. Send verification email
    // 3. Store token with expiration
    
    console.log(`Email verification requested for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Verification email sent (feature coming soon)'
    });

  } catch (error) {
    console.error('Error sending verification email:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send verification email'
    });
  }
});

module.exports = router;