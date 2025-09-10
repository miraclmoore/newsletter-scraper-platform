const rssParser = require('./parser');
const SourceModel = require('../../models/supabase/Source');
const ItemModel = require('../../models/supabase/Item');

class RSSPoller {
  constructor() {
    this.isPolling = false;
    this.pollInterval = parseInt(process.env.RSS_POLL_INTERVAL) || 30 * 60 * 1000; // 30 minutes
    this.maxConcurrent = parseInt(process.env.RSS_MAX_CONCURRENT) || 5;
    this.stats = {
      totalPolled: 0,
      successful: 0,
      failed: 0,
      itemsCreated: 0,
      duplicatesSkipped: 0
    };
  }

  /**
   * Start the RSS polling process
   */
  async startPolling() {
    if (this.isPolling) {
      console.log('RSS polling is already running');
      return;
    }

    this.isPolling = true;
    console.log('Starting RSS polling service');

    // Initial poll
    await this.pollAllFeeds();

    // Set up interval polling
    this.pollTimer = setInterval(async () => {
      await this.pollAllFeeds();
    }, this.pollInterval);

    console.log(`RSS polling scheduled every ${this.pollInterval / 1000 / 60} minutes`);
  }

  /**
   * Stop the RSS polling process
   */
  stopPolling() {
    if (!this.isPolling) {
      console.log('RSS polling is not running');
      return;
    }

    this.isPolling = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    console.log('RSS polling service stopped');
  }

  /**
   * Poll all active RSS feeds
   */
  async pollAllFeeds() {
    try {
      console.log('Starting RSS polling cycle');

      // Get all active RSS sources
      const sources = await this.getActiveRSSFeeds();
      console.log(`Found ${sources.length} active RSS feeds to poll`);

      if (sources.length === 0) {
        return;
      }

      // Process feeds in batches to avoid overwhelming servers
      const batches = this.chunkArray(sources, this.maxConcurrent);
      
      for (const batch of batches) {
        await Promise.all(batch.map(source => this.pollSingleFeed(source)));
      }

      console.log('RSS polling cycle completed:', this.stats);
    } catch (error) {
      console.error('Error during RSS polling cycle:', error);
    }
  }

  /**
   * Poll a single RSS feed
   * @param {Object} source - RSS source object
   */
  async pollSingleFeed(source) {
    try {
      console.log(`Polling RSS feed: ${source.name} (${source.configuration.url})`);

      // Update source status to syncing
      await SourceModel.updateSyncStatus(source.id, 'syncing');

      // Get caching headers from metadata
      const options = {};
      if (source.metadata.etag) {
        options.etag = source.metadata.etag;
      }
      if (source.metadata.lastModified) {
        options.lastModified = source.metadata.lastModified;
      }

      // Parse the feed
      const result = await rssParser.parseFeed(source.configuration.url, options);

      // Handle 304 Not Modified
      if (result.notModified) {
        console.log(`Feed not modified: ${source.name}`);
        
        await SourceModel.update(source.id, {
          lastSyncAt: new Date().toISOString(),
          syncStatus: 'success',
          metadata: {
            ...source.metadata,
            lastPolled: new Date().toISOString(),
            notModified: true
          }
        });

        this.stats.totalPolled++;
        this.stats.successful++;
        return;
      }

      // Process new items
      let itemsCreated = 0;
      let duplicatesSkipped = 0;

      for (const item of result.items) {
        try {
          const created = await this.processRSSItem(item, source);
          if (created) {
            itemsCreated++;
          } else {
            duplicatesSkipped++;
          }
        } catch (error) {
          console.error(`Error processing RSS item from ${source.name}:`, error);
        }
      }

      // Update source with polling results
      await SourceModel.update(source.id, {
        lastSyncAt: new Date().toISOString(),
        syncStatus: 'success',
        itemCount: source.itemCount + itemsCreated,
        metadata: {
          ...source.metadata,
          etag: result.etag,
          lastModified: result.lastModified,
          lastPolled: new Date().toISOString(),
          itemsInFeed: result.items.length,
          itemsCreated: itemsCreated,
          duplicatesSkipped: duplicatesSkipped,
          notModified: false
        }
      });

      console.log(`RSS feed poll completed: ${source.name} - ${itemsCreated} new items, ${duplicatesSkipped} duplicates`);

      this.stats.totalPolled++;
      this.stats.successful++;
      this.stats.itemsCreated += itemsCreated;
      this.stats.duplicatesSkipped += duplicatesSkipped;

    } catch (error) {
      console.error(`Error polling RSS feed ${source.name}:`, error);

      // Update source with error status
      await SourceModel.updateSyncStatus(source.id, 'error', error.message);
      
      // Update error metadata for backoff calculation
      const errorCount = (source.metadata.errorCount || 0) + 1;
      await SourceModel.update(source.id, {
        metadata: {
          ...source.metadata,
          errorCount: errorCount,
          lastError: error.message,
          lastErrorAt: new Date().toISOString(),
          nextRetryAt: this.calculateNextRetry(errorCount)
        }
      });

      this.stats.totalPolled++;
      this.stats.failed++;
    }
  }

  /**
   * Process a single RSS item
   * @param {Object} rssItem - Parsed RSS item
   * @param {Object} source - RSS source
   * @returns {boolean} Whether item was created (false if duplicate)
   */
  async processRSSItem(rssItem, source) {
    try {
      // Check for duplicates using normalized hash
      const existingItem = await ItemModel.findByNormalizedHash(rssItem.normalizedHash);
      if (existingItem && existingItem.userId === source.userId) {
        return false; // Duplicate
      }

      // Check for near-duplicates using fingerprint
      const similarItems = await ItemModel.findSimilarByFingerprint(rssItem.fingerprint, source.userId);
      if (similarItems.length > 0) {
        // Check if any similar items are recent (within 7 days)
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentSimilar = similarItems.find(item => 
          new Date(item.createdAt) > oneWeekAgo
        );
        
        if (recentSimilar) {
          return false; // Recent duplicate
        }
      }

      // Create new item
      const itemData = {
        userId: source.userId,
        sourceId: source.id,
        title: rssItem.title,
        content: rssItem.content,
        rawContent: rssItem.rawContent,
        url: rssItem.link,
        publishedAt: rssItem.publishedAt,
        metadata: {
          ...rssItem.metadata,
          rss: {
            guid: rssItem.guid,
            author: rssItem.author,
            categories: rssItem.categories,
            summary: rssItem.summary
          },
          source: {
            type: 'rss',
            feedTitle: source.name,
            feedUrl: source.configuration.url
          }
        }
      };

      await ItemModel.create(itemData);
      return true; // Successfully created

    } catch (error) {
      console.error('Error processing RSS item:', error);
      return false;
    }
  }

  /**
   * Get all active RSS feeds that need polling
   * @returns {Array} Array of RSS sources
   */
  async getActiveRSSFeeds() {
    try {
      // Use the findReadyForSync method which is designed for this purpose
      const readySources = await SourceModel.findReadyForSync(50);
      
      // Filter for RSS sources only
      return readySources.filter(source => source.type === 'rss');
    } catch (error) {
      console.error('Error getting active RSS feeds:', error);
      return [];
    }
  }

  /**
   * Get minimum polling interval for a source based on its characteristics
   * @param {Object} source - RSS source
   * @returns {number} Minimum interval in milliseconds
   */
  getMinPollInterval(source) {
    // Base interval
    let interval = this.pollInterval;

    // Increase interval for feeds with frequent errors
    const errorCount = source.metadata.errorCount || 0;
    if (errorCount > 0) {
      interval = Math.min(interval * Math.pow(2, errorCount), 24 * 60 * 60 * 1000); // Max 24 hours
    }

    // Decrease interval for high-activity feeds (more items = more frequent updates)
    if (source.itemCount > 100) {
      interval = Math.max(interval * 0.7, 15 * 60 * 1000); // Min 15 minutes
    }

    return interval;
  }

  /**
   * Calculate next retry time for failed feeds
   * @param {number} errorCount - Number of consecutive errors
   * @returns {string} ISO timestamp for next retry
   */
  calculateNextRetry(errorCount) {
    // Exponential backoff: 5min, 15min, 45min, 2h, 6h, 24h
    const backoffMinutes = Math.min(5 * Math.pow(3, errorCount - 1), 24 * 60);
    const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);
    return nextRetry.toISOString();
  }

  /**
   * Manually poll a specific RSS feed
   * @param {string} sourceId - RSS source ID
   * @returns {Object} Polling result
   */
  async pollFeed(sourceId) {
    try {
      const source = await SourceModel.findById(sourceId);
      
      if (!source) {
        throw new Error('RSS source not found');
      }

      if (source.type !== 'rss') {
        throw new Error('Source is not an RSS feed');
      }

      console.log(`Manually polling RSS feed: ${source.name}`);
      
      await this.pollSingleFeed(source);
      
      return {
        success: true,
        message: 'RSS feed polled successfully'
      };
    } catch (error) {
      console.error('Manual RSS poll error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get polling statistics
   * @returns {Object} Polling stats
   */
  getStats() {
    return {
      ...this.stats,
      isPolling: this.isPolling,
      pollInterval: this.pollInterval,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Reset polling statistics
   */
  resetStats() {
    this.stats = {
      totalPolled: 0,
      successful: 0,
      failed: 0,
      itemsCreated: 0,
      duplicatesSkipped: 0
    };
  }

  /**
   * Check RSS polling health
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const successRate = this.stats.totalPolled > 0 ? 
      (this.stats.successful / this.stats.totalPolled) * 100 : 100;

    return {
      status: this.isPolling ? 'running' : 'stopped',
      healthy: successRate > 80,
      successRate: Math.round(successRate),
      stats: this.stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Utility function to chunk array into batches
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

module.exports = new RSSPoller();