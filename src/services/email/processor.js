const emailParser = require('./parser');
const emailValidator = require('./validator');
const UserModel = require('../../models/supabase/User');
const SourceModel = require('../../models/supabase/Source');
const ItemModel = require('../../models/supabase/Item');

class EmailProcessor {
  constructor() {
    this.processingStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      duplicates: 0,
      spam: 0
    };
  }

  /**
   * Process incoming email webhook from SendGrid
   * @param {Object} webhookData - SendGrid webhook payload
   * @returns {Object} Processing result
   */
  async processWebhookEmail(webhookData) {
    try {
      console.log('Processing webhook email:', {
        envelope: webhookData.envelope,
        subject: webhookData.subject,
        from: webhookData.from
      });

      // Extract forwarding address from envelope
      const forwardingAddress = this.extractForwardingAddress(webhookData.envelope);
      if (!forwardingAddress) {
        throw new Error('Unable to extract forwarding address from envelope');
      }

      // Find user by forwarding address
      const user = await this.findUserByForwardingAddress(forwardingAddress);
      if (!user) {
        throw new Error(`No user found for forwarding address: ${forwardingAddress}`);
      }

      // Parse email content
      const parsedEmail = await emailParser.parseEmail(webhookData.email);

      // Validate email
      const validation = await emailValidator.validateEmail(parsedEmail, forwardingAddress);
      
      if (!validation.isValid) {
        console.log('Email failed validation:', validation.reason);
        this.processingStats.failed++;
        return {
          success: false,
          reason: validation.reason,
          riskLevel: validation.riskLevel,
          userId: user.id
        };
      }

      // Check for duplicates
      const duplicate = await this.checkForDuplicate(parsedEmail, user.id);
      if (duplicate) {
        console.log('Duplicate email detected:', duplicate.id);
        this.processingStats.duplicates++;
        return {
          success: true,
          duplicate: true,
          existingItemId: duplicate.id,
          userId: user.id
        };
      }

      // Create or get forwarding source
      const source = await SourceModel.createOrGetForwardingSource(user.id, forwardingAddress);

      // Process and store email
      const item = await this.createNewsletterItem(parsedEmail, user.id, source.id);

      // Update source statistics
      await SourceModel.incrementItemCount(source.id);

      // Send confirmation if enabled
      if (user.preferences && user.preferences.emailNotifications) {
        await this.sendProcessingConfirmation(user.email, item);
      }

      this.processingStats.totalProcessed++;
      this.processingStats.successful++;

      console.log('Email processed successfully:', {
        itemId: item.id,
        userId: user.id,
        sourceId: source.id,
        title: item.title
      });

      return {
        success: true,
        itemId: item.id,
        userId: user.id,
        sourceId: source.id,
        validation: validation,
        duplicate: false
      };

    } catch (error) {
      console.error('Email processing failed:', error);
      this.processingStats.failed++;
      
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }

  /**
   * Process raw email data (for testing or alternative sources)
   * @param {string|Buffer} rawEmail - Raw email content
   * @param {string} forwardingAddress - Target forwarding address
   * @returns {Object} Processing result
   */
  async processRawEmail(rawEmail, forwardingAddress) {
    try {
      // Find user by forwarding address
      const user = await this.findUserByForwardingAddress(forwardingAddress);
      if (!user) {
        throw new Error(`No user found for forwarding address: ${forwardingAddress}`);
      }

      // Parse email
      const parsedEmail = await emailParser.parseEmail(rawEmail);
      
      // Add recipient info for validation
      parsedEmail.to = [{ address: forwardingAddress }];

      // Validate email
      const validation = await emailValidator.validateEmail(parsedEmail, forwardingAddress);
      
      if (!validation.isValid) {
        return {
          success: false,
          reason: validation.reason,
          userId: user.id
        };
      }

      // Check for duplicates
      const duplicate = await this.checkForDuplicate(parsedEmail, user.id);
      if (duplicate) {
        return {
          success: true,
          duplicate: true,
          existingItemId: duplicate.id,
          userId: user.id
        };
      }

      // Create or get forwarding source
      const source = await SourceModel.createOrGetForwardingSource(user.id, forwardingAddress);

      // Create newsletter item
      const item = await this.createNewsletterItem(parsedEmail, user.id, source.id);

      // Update source statistics
      await SourceModel.incrementItemCount(source.id);

      this.processingStats.totalProcessed++;
      this.processingStats.successful++;

      return {
        success: true,
        itemId: item.id,
        userId: user.id,
        sourceId: source.id,
        duplicate: false
      };

    } catch (error) {
      console.error('Raw email processing failed:', error);
      this.processingStats.failed++;
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract forwarding address from SendGrid envelope
   * @param {Object} envelope - SendGrid envelope data
   * @returns {string|null} Forwarding address
   */
  extractForwardingAddress(envelope) {
    if (!envelope || !envelope.to || !Array.isArray(envelope.to)) {
      return null;
    }

    // Find address that matches our forwarding pattern
    const forwardingPattern = /@newsletters\.app$/;
    const forwardingAddress = envelope.to.find(addr => forwardingPattern.test(addr));
    
    return forwardingAddress || null;
  }

  /**
   * Find user by forwarding address
   * @param {string} forwardingAddress - Forwarding address
   * @returns {Object|null} User object or null
   */
  async findUserByForwardingAddress(forwardingAddress) {
    try {
      const { data, error } = await UserModel.supabase
        .from(UserModel.tableName)
        .select('*')
        .eq('forwarding_address', forwardingAddress)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? UserModel.formatUser(data) : null;
    } catch (error) {
      console.error('Error finding user by forwarding address:', error);
      return null;
    }
  }

  /**
   * Check for duplicate content
   * @param {Object} parsedEmail - Parsed email data
   * @param {string} userId - User ID
   * @returns {Object|null} Existing item or null
   */
  async checkForDuplicate(parsedEmail, userId) {
    try {
      const cleanContent = parsedEmail.cleanContent || 
                          emailParser.extractCleanContent(parsedEmail);
      
      const normalizedHash = ItemModel.generateNormalizedHash(
        cleanContent.title, 
        cleanContent.content
      );

      // Check for exact duplicate by hash
      const exactDuplicate = await ItemModel.findByNormalizedHash(normalizedHash);
      if (exactDuplicate && exactDuplicate.userId === userId) {
        return exactDuplicate;
      }

      // Check for near-duplicates by fingerprint
      const fingerprint = ItemModel.generateFingerprint(
        cleanContent.title, 
        cleanContent.content
      );
      
      const similarItems = await ItemModel.findSimilarByFingerprint(fingerprint, userId);
      
      // If we find similar items, check if any are recent (within 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentSimilar = similarItems.find(item => 
        new Date(item.createdAt) > oneDayAgo
      );

      return recentSimilar || null;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return null;
    }
  }

  /**
   * Create newsletter item from parsed email
   * @param {Object} parsedEmail - Parsed email data
   * @param {string} userId - User ID
   * @param {string} sourceId - Source ID
   * @returns {Object} Created item
   */
  async createNewsletterItem(parsedEmail, userId, sourceId) {
    const cleanContent = parsedEmail.cleanContent || 
                        emailParser.extractCleanContent(parsedEmail);

    // Extract additional metadata
    const links = emailParser.extractLinks(parsedEmail.html);
    const fromInfo = parsedEmail.from && parsedEmail.from[0];

    const itemData = {
      userId: userId,
      sourceId: sourceId,
      title: cleanContent.title,
      content: cleanContent.content,
      rawContent: parsedEmail.html || parsedEmail.text,
      url: links.length > 0 ? links[0].url : null,
      publishedAt: parsedEmail.date,
      metadata: {
        ...parsedEmail.metadata,
        sender: {
          name: fromInfo ? fromInfo.name : '',
          address: fromInfo ? fromInfo.address : '',
          domain: fromInfo ? fromInfo.domain : ''
        },
        processing: {
          processedAt: new Date().toISOString(),
          wordCount: cleanContent.wordCount,
          estimatedReadTime: cleanContent.estimatedReadTime,
          hasAttachments: parsedEmail.attachments.length > 0,
          attachmentCount: parsedEmail.attachments.length
        },
        links: links.slice(0, 5), // Store up to 5 links
        originalSubject: parsedEmail.subject,
        messageId: parsedEmail.messageId
      }
    };

    return await ItemModel.create(itemData);
  }

  /**
   * Send processing confirmation email
   * @param {string} userEmail - User's email address
   * @param {Object} item - Created item
   */
  async sendProcessingConfirmation(userEmail, item) {
    try {
      // This would integrate with SendGrid or another email service
      // For now, just log the confirmation
      console.log('Processing confirmation for:', {
        userEmail,
        itemTitle: item.title,
        itemId: item.id
      });

      // TODO: Implement actual email sending
      // const sgMail = require('@sendgrid/mail');
      // await sgMail.send({
      //   to: userEmail,
      //   from: 'notifications@newsletters.app',
      //   subject: `Newsletter processed: ${item.title}`,
      //   text: `Your newsletter "${item.title}" has been successfully processed and added to your dashboard.`,
      //   html: `<p>Your newsletter "<strong>${item.title}</strong>" has been successfully processed and added to your dashboard.</p>`
      // });
    } catch (error) {
      console.error('Failed to send processing confirmation:', error);
      // Don't throw - confirmation failure shouldn't break email processing
    }
  }

  /**
   * Get processing statistics
   * @returns {Object} Processing statistics
   */
  getStats() {
    return { ...this.processingStats };
  }

  /**
   * Reset processing statistics
   */
  resetStats() {
    this.processingStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      duplicates: 0,
      spam: 0
    };
  }

  /**
   * Health check for email processing service
   * @returns {Object} Health status
   */
  healthCheck() {
    const stats = this.getStats();
    const successRate = stats.totalProcessed > 0 ? 
      (stats.successful / stats.totalProcessed) * 100 : 100;

    return {
      status: successRate > 90 ? 'healthy' : successRate > 70 ? 'degraded' : 'unhealthy',
      successRate: Math.round(successRate),
      stats: stats,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new EmailProcessor();