const express = require('express');
const ItemModel = require('../models/supabase/Item');
const SourceModel = require('../models/supabase/Source');
const { authenticateToken } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(generalLimiter);

/**
 * GET /api/items
 * Get newsletter items for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      sourceId, 
      isRead, 
      limit = 50, 
      offset = 0,
      search 
    } = req.query;

    // Validate limit and offset
    const parsedLimit = Math.min(parseInt(limit) || 50, 100); // Max 100 items
    const parsedOffset = parseInt(offset) || 0;

    let items;

    if (search) {
      // Perform full-text search
      items = await ItemModel.search(userId, search, {
        limit: parsedLimit,
        offset: parsedOffset
      });
    } else {
      // Regular filtering
      const options = {
        limit: parsedLimit,
        offset: parsedOffset
      };

      if (sourceId) options.sourceId = sourceId;
      if (isRead !== undefined) options.isRead = isRead === 'true';

      items = await ItemModel.findByUserId(userId, options);
    }

    return res.status(200).json({
      success: true,
      data: items,
      count: items.length,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: items.length === parsedLimit
      }
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch items'
    });
  }
});

/**
 * GET /api/items/:id
 * Get a specific item by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const item = await ItemModel.findById(id);
    
    if (!item) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Item not found'
      });
    }

    // Check ownership
    if (item.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    return res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch item'
    });
  }
});

/**
 * PUT /api/items/:id
 * Update an item (mainly for read status)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Check if item exists and user owns it
    const item = await ItemModel.findById(id);
    
    if (!item) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Item not found'
      });
    }

    if (item.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    // Only allow updating certain fields
    const allowedUpdates = {};
    if (updates.isRead !== undefined) {
      allowedUpdates.isRead = updates.isRead;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No valid fields to update'
      });
    }

    const updatedItem = await ItemModel.update(id, allowedUpdates);

    return res.status(200).json({
      success: true,
      data: updatedItem,
      message: 'Item updated successfully'
    });

  } catch (error) {
    console.error('Error updating item:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update item'
    });
  }
});

/**
 * PUT /api/items/:id/read
 * Mark item as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const item = await ItemModel.findById(id);
    
    if (!item) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Item not found'
      });
    }

    if (item.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    const updatedItem = await ItemModel.markAsRead(id);

    return res.status(200).json({
      success: true,
      data: updatedItem,
      message: 'Item marked as read'
    });
  } catch (error) {
    console.error('Error marking item as read:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to mark item as read'
    });
  }
});

/**
 * PUT /api/items/:id/unread
 * Mark item as unread
 */
router.put('/:id/unread', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const item = await ItemModel.findById(id);
    
    if (!item) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Item not found'
      });
    }

    if (item.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    const updatedItem = await ItemModel.markAsUnread(id);

    return res.status(200).json({
      success: true,
      data: updatedItem,
      message: 'Item marked as unread'
    });
  } catch (error) {
    console.error('Error marking item as unread:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to mark item as unread'
    });
  }
});

/**
 * DELETE /api/items/:id
 * Delete an item
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if item exists and user owns it
    const item = await ItemModel.findById(id);
    
    if (!item) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Item not found'
      });
    }

    if (item.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    await ItemModel.delete(id);

    return res.status(200).json({
      success: true,
      message: 'Item deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting item:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete item'
    });
  }
});

/**
 * POST /api/items/mark-all-read
 * Mark all items as read for the user
 */
router.post('/mark-all-read', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sourceId } = req.body;

    // Get items to mark as read
    const options = { isRead: false };
    if (sourceId) options.sourceId = sourceId;

    const unreadItems = await ItemModel.findByUserId(userId, options);

    // Mark each item as read
    const promises = unreadItems.map(item => ItemModel.markAsRead(item.id));
    await Promise.all(promises);

    return res.status(200).json({
      success: true,
      message: `Marked ${unreadItems.length} items as read`,
      count: unreadItems.length
    });

  } catch (error) {
    console.error('Error marking all items as read:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to mark items as read'
    });
  }
});

/**
 * GET /api/items/stats
 * Get item statistics for the user
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await ItemModel.getStatistics(userId);

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching item stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch item statistics'
    });
  }
});

/**
 * GET /api/items/feed
 * Get main feed of items (alias for GET /items)
 */
router.get('/feed', async (req, res) => {
  // Redirect to main items endpoint
  req.url = '/';
  return router.handle(req, res);
});

module.exports = router;