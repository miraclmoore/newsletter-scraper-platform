const { supabaseAdmin } = require('../../config/supabase');
const bcrypt = require('bcrypt');

class UserModel {
  constructor() {
    this.tableName = 'users';
    this.supabase = supabaseAdmin;
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Object} Created user
   */
  async create(userData) {
    const { email, password, firstName, lastName, preferences = {} } = userData;
    
    const user = {
      email,
      first_name: firstName,
      last_name: lastName,
      preferences: {
        aiSummaries: false,
        emailNotifications: true,
        theme: 'light',
        ...preferences
      },
      is_email_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Hash password if provided
    if (password) {
      const saltRounds = 12;
      user.password_hash = await bcrypt.hash(password, saltRounds);
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert([user])
      .select()
      .single();

    if (error) throw error;
    return this.formatUser(data);
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Object|null} User or null
   */
  async findByEmail(email) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data ? this.formatUser(data) : null;
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Object|null} User or null
   */
  async findById(id) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.formatUser(data) : null;
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated user
   */
  async update(id, updates) {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Convert camelCase to snake_case for database
    if (updates.firstName) {
      updateData.first_name = updates.firstName;
      delete updateData.firstName;
    }
    if (updates.lastName) {
      updateData.last_name = updates.lastName;
      delete updateData.lastName;
    }
    if (updates.isEmailVerified) {
      updateData.is_email_verified = updates.isEmailVerified;
      delete updateData.isEmailVerified;
    }
    if (updates.lastLoginAt) {
      updateData.last_login_at = updates.lastLoginAt;
      delete updateData.lastLoginAt;
    }
    if (updates.forwardingAddress) {
      updateData.forwarding_address = updates.forwardingAddress;
      delete updateData.forwardingAddress;
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.formatUser(data);
  }

  /**
   * Delete user
   * @param {string} id - User ID
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
   * Validate password
   * @param {string} password - Plain text password
   * @param {string} hashedPassword - Hashed password from database
   * @returns {boolean} Whether password is valid
   */
  async validatePassword(password, hashedPassword) {
    if (!hashedPassword) return false;
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate unique forwarding address
   * @param {string} userId - User ID
   * @returns {string} Unique forwarding address
   */
  generateForwardingAddress(userId) {
    const shortId = userId.slice(-8);
    const timestamp = Date.now().toString(36);
    return `${shortId}-${timestamp}@newsletters.app`;
  }

  /**
   * Create or update user's forwarding address
   * @param {string} userId - User ID
   * @returns {Object} Updated user with new forwarding address
   */
  async createForwardingAddress(userId) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new forwarding address
    const forwardingAddress = this.generateForwardingAddress(userId);

    // Update user with new forwarding address
    return await this.update(userId, { forwardingAddress });
  }

  /**
   * Regenerate user's forwarding address
   * @param {string} userId - User ID
   * @returns {Object} Updated user with new forwarding address
   */
  async regenerateForwardingAddress(userId) {
    return await this.createForwardingAddress(userId);
  }

  /**
   * Find user by forwarding address
   * @param {string} forwardingAddress - Forwarding address
   * @returns {Object|null} User or null
   */
  async findByForwardingAddress(forwardingAddress) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('forwarding_address', forwardingAddress)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.formatUser(data) : null;
  }

  /**
   * Ensure user has a forwarding address (create one if missing)
   * @param {string} userId - User ID
   * @returns {Object} User with forwarding address
   */
  async ensureForwardingAddress(userId) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // If user already has a forwarding address, return as-is
    if (user.forwardingAddress) {
      return user;
    }

    // Create forwarding address for user
    return await this.createForwardingAddress(userId);
  }

  /**
   * Format user data from database to API format
   * @private
   */
  formatUser(userData) {
    if (!userData) return null;

    return {
      id: userData.id,
      email: userData.email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      forwardingAddress: userData.forwarding_address,
      preferences: userData.preferences || {},
      isEmailVerified: userData.is_email_verified,
      lastLoginAt: userData.last_login_at,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
      // Don't include password hash in formatted output
    };
  }
}

module.exports = new UserModel();