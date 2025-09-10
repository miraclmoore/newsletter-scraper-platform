const { supabaseAdmin } = require('../../config/supabase');

class SourceModel {
  constructor() {
    this.tableName = 'sources';
    this.supabase = supabaseAdmin;
  }

  /**
   * Create a new source
   * @param {Object} sourceData - Source data
   * @returns {Object} Created source
   */
  async create(sourceData) {
    const {
      userId,
      type,
      name,
      configuration = {},
      metadata = {}
    } = sourceData;

    const source = {
      user_id: userId,
      type,
      name,
      configuration,
      metadata,
      is_active: true,
      sync_status: 'pending',
      item_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert([source])
      .select()
      .single();

    if (error) throw error;
    return this.formatSource(data);
  }

  /**
   * Create or update source (upsert)
   * @param {Object} sourceData - Source data
   * @returns {Object} Created/updated source
   */
  async upsert(sourceData) {
    const { userId, type } = sourceData;

    // Try to find existing source
    const existingSource = await this.findByUserAndType(userId, type);

    if (existingSource) {
      return this.update(existingSource.id, sourceData);
    } else {
      return this.create(sourceData);
    }
  }

  /**
   * Find source by ID
   * @param {string} id - Source ID
   * @returns {Object|null} Source or null
   */
  async findById(id) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.formatSource(data) : null;
  }

  /**
   * Find source by user and type
   * @param {string} userId - User ID
   * @param {string} type - Source type
   * @returns {Object|null} Source or null
   */
  async findByUserAndType(userId, type) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.formatSource(data) : null;
  }

  /**
   * Find all sources for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Array of sources
   */
  async findByUser(userId, options = {}) {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId);

    if (options.activeOnly !== false) {
      query = query.eq('is_active', true);
    }

    if (options.type) {
      query = query.eq('type', options.type);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data.map(source => this.formatSource(source));
  }

  /**
   * Update source
   * @param {string} id - Source ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated source
   */
  async update(id, updates) {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Convert camelCase to snake_case for database
    if (updates.isActive !== undefined) {
      updateData.is_active = updates.isActive;
      delete updateData.isActive;
    }
    if (updates.syncStatus) {
      updateData.sync_status = updates.syncStatus;
      delete updateData.syncStatus;
    }
    if (updates.lastSyncAt) {
      updateData.last_sync_at = updates.lastSyncAt;
      delete updateData.lastSyncAt;
    }
    if (updates.errorMessage) {
      updateData.error_message = updates.errorMessage;
      delete updateData.errorMessage;
    }
    if (updates.itemCount !== undefined) {
      updateData.item_count = updates.itemCount;
      delete updateData.itemCount;
    }
    if (updates.userId) {
      updateData.user_id = updates.userId;
      delete updateData.userId;
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.formatSource(data);
  }

  /**
   * Update sync status
   * @param {string} id - Source ID
   * @param {string} status - Sync status (pending, syncing, success, error)
   * @param {string} errorMessage - Optional error message
   * @returns {Object} Updated source
   */
  async updateSyncStatus(id, status, errorMessage = null) {
    const updates = {
      sync_status: status,
      sync_error: errorMessage,
      updated_at: new Date().toISOString()
    };

    if (status === 'success') {
      updates.last_sync_at = new Date().toISOString();
      updates.sync_error = null;
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.formatSource(data);
  }

  /**
   * Increment item count
   * @param {string} id - Source ID
   * @param {number} increment - Amount to increment by (default: 1)
   * @returns {Object} Updated source
   */
  async incrementItemCount(id, increment = 1) {
    // First get current count
    const source = await this.findById(id);
    if (!source) throw new Error('Source not found');

    const newCount = (source.itemCount || 0) + increment;

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        item_count: newCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.formatSource(data);
  }

  /**
   * Deactivate source (soft delete)
   * @param {string} id - Source ID
   * @returns {boolean} Success status
   */
  async deactivate(id) {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /**
   * Delete source permanently
   * @param {string} id - Source ID
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
   * Delete all sources for a user
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  async deleteByUser(userId) {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  /**
   * Get sources that need syncing
   * @param {number} limit - Maximum number of sources to return
   * @returns {Array} Array of sources ready for sync
   */
  async findReadyForSync(limit = 50) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .in('sync_status', ['pending', 'error'])
      .or(`last_sync_at.is.null,last_sync_at.lt.${fiveMinutesAgo}`)
      .order('last_sync_at', { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) throw error;
    return data.map(source => this.formatSource(source));
  }

  /**
   * Format source data from database to API format
   * @private
   */
  formatSource(sourceData) {
    if (!sourceData) return null;

    return {
      id: sourceData.id,
      userId: sourceData.user_id,
      type: sourceData.type,
      name: sourceData.name,
      configuration: sourceData.configuration || {},
      metadata: sourceData.metadata || {},
      isActive: sourceData.is_active,
      syncStatus: sourceData.sync_status,
      errorMessage: sourceData.error_message,
      itemCount: sourceData.item_count || 0,
      lastSyncAt: sourceData.last_sync_at,
      createdAt: sourceData.created_at,
      updatedAt: sourceData.updated_at
    };
  }
}

module.exports = new SourceModel();