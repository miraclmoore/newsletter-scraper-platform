const { supabaseAdmin } = require('../../config/supabase');
const crypto = require('crypto');

class ItemModel {
  constructor() {
    this.tableName = 'items';
    this.supabase = supabaseAdmin;
  }

  /**
   * Create a new item
   * @param {Object} itemData - Item data
   * @returns {Object} Created item
   */
  async create(itemData) {
    const {
      userId,
      sourceId,
      title,
      content,
      rawContent,
      url,
      publishedAt,
      metadata = {}
    } = itemData;

    // Generate content hashes for deduplication
    const normalizedHash = this.generateNormalizedHash(title, content);
    const fingerprint = this.generateFingerprint(title, content);

    const item = {
      user_id: userId,
      source_id: sourceId,
      title,
      content,
      raw_content: rawContent,
      url,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
      normalized_hash: normalizedHash,
      fingerprint,
      is_read: false,
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert([item])
      .select()
      .single();

    if (error) throw error;
    return this.formatItem(data);
  }

  /**
   * Find item by ID
   * @param {string} id - Item ID
   * @returns {Object|null} Item or null
   */
  async findById(id) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.formatItem(data) : null;
  }

  /**
   * Find items by user ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Array of items
   */
  async findByUserId(userId, options = {}) {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId);

    if (options.sourceId) {
      query = query.eq('source_id', options.sourceId);
    }

    if (options.isRead !== undefined) {
      query = query.eq('is_read', options.isRead);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    query = query.order('published_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data.map(item => this.formatItem(item));
  }

  /**
   * Find items by source ID
   * @param {string} sourceId - Source ID
   * @param {Object} options - Query options
   * @returns {Array} Array of items
   */
  async findBySourceId(sourceId, options = {}) {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('source_id', sourceId);

    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('published_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data.map(item => this.formatItem(item));
  }

  /**
   * Check if item exists by normalized hash
   * @param {string} normalizedHash - Normalized hash
   * @returns {Object|null} Existing item or null
   */
  async findByNormalizedHash(normalizedHash) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('normalized_hash', normalizedHash)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.formatItem(data) : null;
  }

  /**
   * Find similar items by fingerprint for near-duplicate detection
   * @param {string} fingerprint - Content fingerprint
   * @param {string} userId - User ID
   * @returns {Array} Array of similar items
   */
  async findSimilarByFingerprint(fingerprint, userId) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('fingerprint', fingerprint)
      .eq('user_id', userId);

    if (error) throw error;
    return data.map(item => this.formatItem(item));
  }

  /**
   * Update item
   * @param {string} id - Item ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated item
   */
  async update(id, updates) {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Convert camelCase to snake_case for database
    if (updates.userId) {
      updateData.user_id = updates.userId;
      delete updateData.userId;
    }
    if (updates.sourceId) {
      updateData.source_id = updates.sourceId;
      delete updateData.sourceId;
    }
    if (updates.rawContent) {
      updateData.raw_content = updates.rawContent;
      delete updateData.rawContent;
    }
    if (updates.publishedAt) {
      updateData.published_at = new Date(updates.publishedAt).toISOString();
      delete updateData.publishedAt;
    }
    if (updates.normalizedHash) {
      updateData.normalized_hash = updates.normalizedHash;
      delete updateData.normalizedHash;
    }
    if (updates.isRead !== undefined) {
      updateData.is_read = updates.isRead;
      delete updateData.isRead;
    }

    // If content or title is being updated, regenerate hashes
    if (updates.title || updates.content) {
      const title = updates.title || '';
      const content = updates.content || '';
      updateData.normalized_hash = this.generateNormalizedHash(title, content);
      updateData.fingerprint = this.generateFingerprint(title, content);
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.formatItem(data);
  }

  /**
   * Mark item as read
   * @param {string} id - Item ID
   * @returns {Object} Updated item
   */
  async markAsRead(id) {
    return await this.update(id, { isRead: true });
  }

  /**
   * Mark item as unread
   * @param {string} id - Item ID
   * @returns {Object} Updated item
   */
  async markAsUnread(id) {
    return await this.update(id, { isRead: false });
  }

  /**
   * Delete item
   * @param {string} id - Item ID
   * @returns {boolean} Success status
   */
  async delete(id) {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /**
   * Delete items by source ID
   * @param {string} sourceId - Source ID
   * @returns {boolean} Success status
   */
  async deleteBySourceId(sourceId) {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('source_id', sourceId);

    if (error) throw error;
    return true;
  }

  /**
   * Delete items by user ID
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  async deleteByUserId(userId) {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  /**
   * Search items with full-text search
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Array of matching items
   */
  async search(userId, query, options = {}) {
    let dbQuery = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .textSearch('title,content', query);

    if (options.limit) {
      dbQuery = dbQuery.limit(options.limit);
    }

    dbQuery = dbQuery.order('published_at', { ascending: false });

    const { data, error } = await dbQuery;

    if (error) throw error;
    return data.map(item => this.formatItem(item));
  }

  /**
   * Get item statistics for user
   * @param {string} userId - User ID
   * @returns {Object} Statistics object
   */
  async getStatistics(userId) {
    const { data: totalCount, error: totalError } = await this.supabase
      .from(this.tableName)
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    if (totalError) throw totalError;

    const { data: readCount, error: readError } = await this.supabase
      .from(this.tableName)
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', true);

    if (readError) throw readError;

    const { data: recentCount, error: recentError } = await this.supabase
      .from(this.tableName)
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (recentError) throw recentError;

    return {
      total: totalCount.length,
      read: readCount.length,
      unread: totalCount.length - readCount.length,
      recentWeek: recentCount.length
    };
  }

  /**
   * Generate normalized hash for exact duplicate detection
   * @param {string} title - Item title
   * @param {string} content - Item content
   * @returns {string} SHA-256 hash
   */
  generateNormalizedHash(title, content) {
    // Normalize content for hash generation
    const normalizedTitle = (title || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedContent = (content || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const combined = `${normalizedTitle}|${normalizedContent}`;
    
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Generate fingerprint for near-duplicate detection
   * @param {string} title - Item title
   * @param {string} content - Item content
   * @returns {string} MD5 hash of key features
   */
  generateFingerprint(title, content) {
    // Extract key features for similarity matching
    const titleWords = (title || '').toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const contentWords = (content || '').toLowerCase().split(/\W+/).filter(w => w.length > 4);
    
    // Take first 50 chars of content and significant words
    const features = [
      ...titleWords.slice(0, 5),
      ...contentWords.slice(0, 10),
      (content || '').substring(0, 50).toLowerCase().replace(/\W/g, '')
    ].join('|');
    
    return crypto.createHash('md5').update(features).digest('hex').substring(0, 8);
  }

  /**
   * Format item data from database to API format
   * @private
   */
  formatItem(itemData) {
    if (!itemData) return null;

    return {
      id: itemData.id,
      userId: itemData.user_id,
      sourceId: itemData.source_id,
      title: itemData.title,
      content: itemData.content,
      rawContent: itemData.raw_content,
      url: itemData.url,
      publishedAt: itemData.published_at,
      normalizedHash: itemData.normalized_hash,
      fingerprint: itemData.fingerprint,
      isRead: itemData.is_read,
      metadata: itemData.metadata || {},
      createdAt: itemData.created_at,
      updatedAt: itemData.updated_at
    };
  }
}

module.exports = new ItemModel();