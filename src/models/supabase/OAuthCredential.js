const { supabaseAdmin } = require('../../config/supabase');
const crypto = require('crypto');

class OAuthCredentialModel {
  constructor() {
    this.tableName = 'oauth_credentials';
    this.supabase = supabaseAdmin;
  }

  /**
   * Create or update OAuth credential
   * @param {Object} credentialData - Credential data
   * @returns {Object} Created/updated credential
   */
  async upsert(credentialData) {
    const {
      userId,
      provider,
      providerUserId,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      scopes = [],
      metadata = {}
    } = credentialData;

    const credential = {
      user_id: userId,
      provider,
      provider_user_id: providerUserId,
      encrypted_access_token: this.encryptToken(accessToken),
      encrypted_refresh_token: refreshToken ? this.encryptToken(refreshToken) : null,
      token_expires_at: tokenExpiresAt,
      scopes,
      metadata,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    // Try to update first, then insert if not exists
    const { data: existingData, error: findError } = await this.supabase
      .from(this.tableName)
      .select('id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (findError && findError.code !== 'PGRST116') throw findError;

    if (existingData) {
      // Update existing
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update(credential)
        .eq('id', existingData.id)
        .select()
        .single();

      if (error) throw error;
      return this.formatCredential(data);
    } else {
      // Insert new
      credential.created_at = new Date().toISOString();
      
      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert([credential])
        .select()
        .single();

      if (error) throw error;
      return this.formatCredential(data);
    }
  }

  /**
   * Find credential by user and provider
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @returns {Object|null} Credential or null
   */
  async findByUserAndProvider(userId, provider) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.formatCredential(data) : null;
  }

  /**
   * Find all credentials for a user
   * @param {string} userId - User ID
   * @returns {Array} Array of credentials
   */
  async findByUser(userId) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(credential => this.formatCredential(credential));
  }

  /**
   * Update credential tokens
   * @param {string} id - Credential ID
   * @param {Object} tokenData - Token data
   * @returns {Object} Updated credential
   */
  async updateTokens(id, tokenData) {
    const updates = {
      updated_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString()
    };

    if (tokenData.accessToken) {
      updates.encrypted_access_token = this.encryptToken(tokenData.accessToken);
    }
    if (tokenData.refreshToken) {
      updates.encrypted_refresh_token = this.encryptToken(tokenData.refreshToken);
    }
    if (tokenData.expiresAt) {
      updates.token_expires_at = tokenData.expiresAt;
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.formatCredential(data);
  }

  /**
   * Deactivate credential (soft delete)
   * @param {string} id - Credential ID
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
   * Delete credential permanently
   * @param {string} id - Credential ID
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
   * Check if token is expired
   * @param {Object} credential - Credential object
   * @returns {boolean} Whether token is expired
   */
  isTokenExpired(credential) {
    if (!credential.tokenExpiresAt) return false;
    return new Date() >= new Date(credential.tokenExpiresAt);
  }

  /**
   * Encrypt token using AES-256-GCM
   * @private
   */
  encryptToken(token) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf8');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('oauth-token', 'utf8'));
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted: encrypted,
      authTag: authTag.toString('hex')
    });
  }

  /**
   * Decrypt token using AES-256-GCM
   * @private
   */
  decryptToken(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf8');
    
    const data = JSON.parse(encryptedData);
    const iv = Buffer.from(data.iv, 'hex');
    const authTag = Buffer.from(data.authTag, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('oauth-token', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Format credential data from database to API format
   * @private
   */
  formatCredential(credentialData) {
    if (!credentialData) return null;

    return {
      id: credentialData.id,
      userId: credentialData.user_id,
      provider: credentialData.provider,
      providerUserId: credentialData.provider_user_id,
      tokenExpiresAt: credentialData.token_expires_at,
      scopes: credentialData.scopes || [],
      metadata: credentialData.metadata || {},
      isActive: credentialData.is_active,
      lastSyncAt: credentialData.last_sync_at,
      createdAt: credentialData.created_at,
      updatedAt: credentialData.updated_at,
      // Provide methods to get decrypted tokens
      getAccessToken: () => this.decryptToken(credentialData.encrypted_access_token),
      getRefreshToken: () => credentialData.encrypted_refresh_token ? 
        this.decryptToken(credentialData.encrypted_refresh_token) : null,
      isTokenExpired: () => this.isTokenExpired(credentialData)
    };
  }
}

module.exports = new OAuthCredentialModel();