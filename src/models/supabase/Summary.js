const { supabaseAdmin } = require('../../config/supabase');

class Summary {
  static tableName = 'summaries';
  static supabase = supabaseAdmin;

  /**
   * Create a new summary
   * @param {Object} summaryData - Summary data
   * @returns {Object} Created summary
   */
  static async create(summaryData) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert([{
          item_id: summaryData.itemId,
          user_id: summaryData.userId,
          headline: summaryData.headline,
          bullets: summaryData.bullets,
          model_used: summaryData.modelUsed,
          tokens_used: summaryData.tokensUsed,
          processing_time_ms: summaryData.processingTimeMs,
          content_hash: summaryData.contentHash,
          generated_at: summaryData.generatedAt || new Date().toISOString(),
          metadata: summaryData.metadata || {}
        }])
        .select()
        .single();

      if (error) throw error;

      return this.formatSummary(data);
    } catch (error) {
      console.error('Error creating summary:', error);
      throw new Error(`Failed to create summary: ${error.message}`);
    }
  }

  /**
   * Find summary by item ID
   * @param {string} itemId - Item ID
   * @returns {Object|null} Summary or null
   */
  static async findByItemId(itemId) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('item_id', itemId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data ? this.formatSummary(data) : null;
    } catch (error) {
      console.error('Error finding summary by item ID:', error);
      return null;
    }
  }

  /**
   * Find summary by content hash (for caching)
   * @param {string} contentHash - Content hash
   * @param {string} model - AI model used
   * @returns {Object|null} Summary or null
   */
  static async findByContentHash(contentHash, model = 'gpt-3.5-turbo') {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('content_hash', contentHash)
        .eq('model_used', model)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data ? this.formatSummary(data) : null;
    } catch (error) {
      console.error('Error finding summary by content hash:', error);
      return null;
    }
  }

  /**
   * Find summaries for multiple items (for dashboard)
   * @param {Array} itemIds - Array of item IDs
   * @returns {Array} Array of summaries
   */
  static async findByItemIds(itemIds) {
    try {
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return [];
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('item_id', itemIds);

      if (error) throw error;

      return data.map(summary => this.formatSummary(summary));
    } catch (error) {
      console.error('Error finding summaries by item IDs:', error);
      return [];
    }
  }

  /**
   * Update summary
   * @param {string} id - Summary ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated summary
   */
  static async update(id, updates) {
    try {
      const updateData = {};

      // Map frontend fields to database fields
      if (updates.headline !== undefined) updateData.headline = updates.headline;
      if (updates.bullets !== undefined) updateData.bullets = updates.bullets;
      if (updates.modelUsed !== undefined) updateData.model_used = updates.modelUsed;
      if (updates.tokensUsed !== undefined) updateData.tokens_used = updates.tokensUsed;
      if (updates.processingTimeMs !== undefined) updateData.processing_time_ms = updates.processingTimeMs;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.formatSummary(data);
    } catch (error) {
      console.error('Error updating summary:', error);
      throw new Error(`Failed to update summary: ${error.message}`);
    }
  }

  /**
   * Delete summary
   * @param {string} id - Summary ID
   * @returns {boolean} Success status
   */
  static async delete(id) {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting summary:', error);
      return false;
    }
  }

  /**
   * Delete summary by item ID
   * @param {string} itemId - Item ID
   * @returns {boolean} Success status
   */
  static async deleteByItemId(itemId) {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('item_id', itemId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting summary by item ID:', error);
      return false;
    }
  }

  /**
   * Get usage statistics for user
   * @param {string} userId - User ID
   * @param {string} timeframe - Timeframe ('month', 'day', 'all')
   * @returns {Object} Usage statistics
   */
  static async getUserUsageStats(userId, timeframe = 'month') {
    try {
      let dateFilter;
      const now = new Date();

      switch (timeframe) {
        case 'day':
          dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          break;
        case 'month':
          dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          break;
        default:
          dateFilter = null;
      }

      let query = this.supabase
        .from(this.tableName)
        .select('tokens_used, generated_at')
        .eq('user_id', userId);

      if (dateFilter) {
        query = query.gte('generated_at', dateFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const totalRequests = data.length;
      const totalTokens = data.reduce((sum, summary) => sum + (summary.tokens_used || 0), 0);

      return {
        requests: totalRequests,
        tokens: totalTokens,
        timeframe,
        period: timeframe === 'month' 
          ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          : timeframe === 'day'
            ? now.toISOString().split('T')[0]
            : 'all-time'
      };
    } catch (error) {
      console.error('Error getting user usage stats:', error);
      return {
        requests: 0,
        tokens: 0,
        timeframe,
        error: error.message
      };
    }
  }

  /**
   * Clean old summaries (for maintenance)
   * @param {number} daysOld - Number of days old
   * @returns {number} Number of deleted summaries
   */
  static async cleanOldSummaries(daysOld = 90) {
    try {
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000)).toISOString();

      const { data, error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lt('generated_at', cutoffDate)
        .select('id');

      if (error) throw error;

      return data.length;
    } catch (error) {
      console.error('Error cleaning old summaries:', error);
      return 0;
    }
  }

  /**
   * Generate content hash for caching
   * @param {string} content - Content to hash
   * @param {string} model - Model used
   * @returns {string} Content hash
   */
  static generateContentHash(content, model = 'gpt-3.5-turbo') {
    const crypto = require('crypto');
    const combinedContent = `${model}:${content}`;
    return crypto.createHash('sha256').update(combinedContent).digest('hex');
  }

  /**
   * Format summary data for frontend
   * @param {Object} dbSummary - Raw database summary
   * @returns {Object} Formatted summary
   */
  static formatSummary(dbSummary) {
    if (!dbSummary) return null;

    return {
      id: dbSummary.id,
      itemId: dbSummary.item_id,
      userId: dbSummary.user_id,
      headline: dbSummary.headline,
      bullets: dbSummary.bullets || [],
      modelUsed: dbSummary.model_used,
      tokensUsed: dbSummary.tokens_used,
      processingTimeMs: dbSummary.processing_time_ms,
      contentHash: dbSummary.content_hash,
      generatedAt: dbSummary.generated_at,
      updatedAt: dbSummary.updated_at,
      createdAt: dbSummary.created_at,
      metadata: dbSummary.metadata || {}
    };
  }

  /**
   * Create table if it doesn't exist (for setup)
   * @returns {Promise} Creation promise
   */
  static async createTable() {
    try {
      // This would be handled by Supabase migrations in practice
      console.log('Summary table should be created via Supabase migrations');
      return true;
    } catch (error) {
      console.error('Error creating summary table:', error);
      return false;
    }
  }
}

module.exports = Summary;