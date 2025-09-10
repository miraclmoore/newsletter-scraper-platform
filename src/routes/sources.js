const express = require('express');
const SourceModel = require('../models/supabase/Source');
const UserModel = require('../models/supabase/User');
const { rssParser, rssPoller } = require('../services/rss');
const { authenticateToken } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(generalLimiter);

/**
 * GET /api/sources
 * Get all sources for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, activeOnly } = req.query;

    const options = {};
    if (type) options.type = type;
    if (activeOnly !== undefined) options.activeOnly = activeOnly === 'true';

    const sources = await SourceModel.findByUser(userId, options);

    return res.status(200).json({
      success: true,
      data: sources,
      count: sources.length
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch sources'
    });
  }
});

/**
 * GET /api/sources/stats
 * Get source statistics for the user
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const sources = await SourceModel.findByUser(userId);
    
    const stats = {
      total: sources.length,
      active: sources.filter(s => s.isActive).length,
      byType: {},
      byStatus: {},
      totalItems: sources.reduce((sum, s) => sum + (s.itemCount || 0), 0)
    };

    // Group by type
    sources.forEach(source => {
      stats.byType[source.type] = (stats.byType[source.type] || 0) + 1;
    });

    // Group by sync status
    sources.forEach(source => {
      stats.byStatus[source.syncStatus] = (stats.byStatus[source.syncStatus] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching source stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch source statistics'
    });
  }
});

/**
 * GET /api/sources/:id
 * Get a specific source by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const source = await SourceModel.findById(id);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Source not found'
      });
    }

    // Check ownership
    if (source.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    return res.status(200).json({
      success: true,
      data: source
    });
  } catch (error) {
    console.error('Error fetching source:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch source'
    });
  }
});

/**
 * POST /api/sources
 * Create a new source
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, name, configuration } = req.body;

    // Validate required fields
    if (!type || !name) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Type and name are required'
      });
    }

    // Validate supported source types
    const supportedTypes = ['rss', 'gmail', 'outlook', 'forwarding'];
    if (!supportedTypes.includes(type)) {
      return res.status(400).json({
        error: 'Validation error',
        message: `Unsupported source type. Supported types: ${supportedTypes.join(', ')}`
      });
    }

    // Handle RSS-specific validation
    if (type === 'rss') {
      if (!configuration || !configuration.url) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'RSS URL is required in configuration'
        });
      }

      // Validate RSS feed
      console.log(`Validating RSS feed: ${configuration.url}`);
      const validation = await rssParser.validateFeed(configuration.url);
      
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid RSS feed',
          message: validation.error
        });
      }

      // Use feed data for source metadata
      const sourceData = {
        userId,
        type,
        name: validation.feedData.title || name,
        configuration: {
          url: configuration.url,
          title: validation.feedData.title,
          description: validation.feedData.description,
          link: validation.feedData.link
        },
        metadata: {
          language: validation.feedData.language,
          itemsInFeed: validation.feedData.itemCount,
          createdVia: 'api',
          validatedAt: new Date().toISOString()
        }
      };

      const source = await SourceModel.create(sourceData);

      // Trigger initial poll
      setTimeout(async () => {
        try {
          await rssPoller.pollFeed(source.id);
        } catch (error) {
          console.error('Error in initial RSS poll:', error);
        }
      }, 1000);

      return res.status(201).json({
        success: true,
        data: source,
        message: 'RSS source created successfully'
      });
    }

    // Handle other source types (forwarding, OAuth)
    const sourceData = {
      userId,
      type,
      name,
      configuration: configuration || {},
      metadata: {
        createdVia: 'api'
      }
    };

    const source = await SourceModel.create(sourceData);

    return res.status(201).json({
      success: true,
      data: source,
      message: 'Source created successfully'
    });

  } catch (error) {
    console.error('Error creating source:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create source'
    });
  }
});

/**
 * PUT /api/sources/:id
 * Update a source
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Check if source exists and user owns it
    const source = await SourceModel.findById(id);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Source not found'
      });
    }

    if (source.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    // For RSS sources, validate URL if it's being updated
    if (source.type === 'rss' && updates.configuration && updates.configuration.url) {
      const validation = await rssParser.validateFeed(updates.configuration.url);
      
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid RSS feed',
          message: validation.error
        });
      }

      // Update configuration with feed data
      updates.configuration = {
        ...updates.configuration,
        title: validation.feedData.title,
        description: validation.feedData.description,
        link: validation.feedData.link
      };

      updates.metadata = {
        ...source.metadata,
        ...updates.metadata,
        language: validation.feedData.language,
        itemsInFeed: validation.feedData.itemCount,
        lastValidated: new Date().toISOString()
      };
    }

    const updatedSource = await SourceModel.update(id, updates);

    return res.status(200).json({
      success: true,
      data: updatedSource,
      message: 'Source updated successfully'
    });

  } catch (error) {
    console.error('Error updating source:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update source'
    });
  }
});

/**
 * DELETE /api/sources/:id
 * Delete a source
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if source exists and user owns it
    const source = await SourceModel.findById(id);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Source not found'
      });
    }

    if (source.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    await SourceModel.delete(id);

    return res.status(200).json({
      success: true,
      message: 'Source deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting source:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete source'
    });
  }
});

/**
 * POST /api/sources/:id/poll
 * Manually trigger polling for an RSS source
 */
router.post('/:id/poll', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if source exists and user owns it
    const source = await SourceModel.findById(id);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Source not found'
      });
    }

    if (source.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    if (source.type !== 'rss') {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Only RSS sources can be polled'
      });
    }

    // Trigger manual poll
    const result = await rssPoller.pollFeed(id);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'RSS feed polled successfully'
      });
    } else {
      return res.status(500).json({
        error: 'Polling failed',
        message: result.error
      });
    }

  } catch (error) {
    console.error('Error polling source:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to poll source'
    });
  }
});

/**
 * POST /api/sources/validate-rss
 * Validate an RSS feed URL without creating a source
 */
router.post('/validate-rss', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'URL is required'
      });
    }

    const validation = await rssParser.validateFeed(url);

    if (validation.valid) {
      return res.status(200).json({
        success: true,
        valid: true,
        data: validation.feedData,
        message: 'RSS feed is valid'
      });
    } else {
      return res.status(200).json({
        success: true,
        valid: false,
        error: validation.error,
        message: 'RSS feed validation failed'
      });
    }

  } catch (error) {
    console.error('Error validating RSS feed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate RSS feed'
    });
  }
});

/**
 * POST /api/sources/discover-feeds
 * Discover RSS feeds from a webpage URL
 */
router.post('/discover-feeds', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'URL is required'
      });
    }

    const feeds = await rssParser.discoverFeeds(url);

    return res.status(200).json({
      success: true,
      data: feeds,
      count: feeds.length,
      message: `Found ${feeds.length} RSS feeds`
    });

  } catch (error) {
    console.error('Error discovering feeds:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to discover feeds'
    });
  }
});

module.exports = router;