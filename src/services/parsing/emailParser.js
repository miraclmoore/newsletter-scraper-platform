const ContentExtractor = require('./contentExtractor');
const { simpleParser } = require('mailparser');

/**
 * Email Parser Service
 * Handles complete email parsing including MIME parsing and content extraction
 */
class EmailParser {
  constructor() {
    this.contentExtractor = new ContentExtractor();
  }

  /**
   * Parse complete email from raw source
   * @param {string} rawEmail - Raw email source
   * @param {Object} options - Parsing options
   * @returns {Object} Parsed email data
   */
  async parseEmail(rawEmail, options = {}) {
    try {
      const startTime = Date.now();
      
      // Parse MIME structure
      const parsed = await simpleParser(rawEmail, {
        skipHtmlToText: true,
        skipTextToHtml: true,
        skipImageLinks: false
      });
      
      // Extract basic email metadata
      const emailData = {
        messageId: parsed.messageId,
        subject: parsed.subject || 'No Subject',
        from: this.parseAddress(parsed.from),
        to: this.parseAddresses(parsed.to),
        date: parsed.date || new Date(),
        headers: this.extractImportantHeaders(parsed.headers),
        attachments: this.processAttachments(parsed.attachments || [])
      };

      // Determine content type and extract content
      let contentResult;
      
      if (parsed.html) {
        // HTML email - extract main content
        contentResult = await this.contentExtractor.extractContent(
          parsed.html,
          this.extractBaseUrl(emailData.from.email)
        );
      } else if (parsed.text) {
        // Plain text email - convert to HTML
        contentResult = this.contentExtractor.processPlainTextEmail(parsed.text);
      } else {
        // No content found
        contentResult = this.contentExtractor.fallbackExtraction('No content found');
      }

      // Combine email metadata with content
      const result = {
        ...emailData,
        ...contentResult,
        rawSize: rawEmail.length,
        totalProcessingTime: Date.now() - startTime,
        contentType: parsed.html ? 'html' : (parsed.text ? 'text' : 'empty'),
        parsingSuccess: contentResult.success,
        parsedAt: new Date().toISOString()
      };

      // Ensure title falls back to subject if extraction failed
      if (!result.title || result.title === 'Newsletter') {
        result.title = emailData.subject;
      }

      return result;

    } catch (error) {
      console.error('Email parsing failed:', error);
      
      return {
        subject: 'Parsing Failed',
        title: 'Email Parsing Failed',
        content: `<p>Failed to parse email content: ${error.message}</p>`,
        textContent: `Failed to parse email content: ${error.message}`,
        excerpt: 'Email parsing failed',
        from: { name: 'Unknown', email: 'unknown@example.com' },
        to: [],
        date: new Date(),
        wordCount: 0,
        readingTime: 0,
        links: [],
        images: [],
        attachments: [],
        headers: {},
        rawSize: rawEmail.length,
        totalProcessingTime: 0,
        contentType: 'error',
        parsingSuccess: false,
        extractionMethod: 'error',
        error: error.message,
        parsedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Parse webhook email data (already parsed)
   * @param {Object} webhookData - Webhook email data
   * @returns {Object} Processed email data
   */
  async parseWebhookEmail(webhookData) {
    try {
      const startTime = Date.now();

      // Extract envelope data
      const envelope = webhookData.envelope || {};
      const fromEmail = envelope.from || '';
      const toEmails = Array.isArray(envelope.to) ? envelope.to : [envelope.to];

      const emailData = {
        messageId: webhookData.messageId || `webhook-${Date.now()}`,
        subject: webhookData.subject || 'No Subject',
        from: this.parseEmailString(fromEmail),
        to: toEmails.map(email => this.parseEmailString(email)),
        date: webhookData.timestamp ? new Date(webhookData.timestamp * 1000) : new Date(),
        headers: webhookData.headers || {},
        attachments: webhookData.attachments || []
      };

      // Extract content from webhook data
      let contentResult;
      
      if (webhookData.html) {
        // HTML content available
        contentResult = await this.contentExtractor.extractContent(
          webhookData.html,
          this.extractBaseUrl(emailData.from.email)
        );
      } else if (webhookData.email || webhookData.text) {
        // Text content or raw email
        const textContent = webhookData.text || webhookData.email;
        contentResult = this.contentExtractor.processPlainTextEmail(textContent);
      } else {
        // No content found
        contentResult = this.contentExtractor.fallbackExtraction('No content in webhook data');
      }

      const result = {
        ...emailData,
        ...contentResult,
        rawSize: JSON.stringify(webhookData).length,
        totalProcessingTime: Date.now() - startTime,
        contentType: webhookData.html ? 'html' : 'text',
        parsingSuccess: contentResult.success,
        parsedAt: new Date().toISOString(),
        source: 'webhook'
      };

      // Ensure title falls back to subject if extraction failed
      if (!result.title || result.title === 'Newsletter') {
        result.title = emailData.subject;
      }

      return result;

    } catch (error) {
      console.error('Webhook email parsing failed:', error);
      
      return {
        subject: webhookData.subject || 'Parsing Failed',
        title: webhookData.subject || 'Webhook Parsing Failed',
        content: `<p>Failed to parse webhook email: ${error.message}</p>`,
        textContent: `Failed to parse webhook email: ${error.message}`,
        excerpt: 'Webhook email parsing failed',
        from: { name: 'Unknown', email: 'unknown@example.com' },
        to: [],
        date: new Date(),
        wordCount: 0,
        readingTime: 0,
        links: [],
        images: [],
        attachments: [],
        headers: {},
        rawSize: JSON.stringify(webhookData).length,
        totalProcessingTime: 0,
        contentType: 'error',
        parsingSuccess: false,
        extractionMethod: 'error',
        error: error.message,
        parsedAt: new Date().toISOString(),
        source: 'webhook'
      };
    }
  }

  /**
   * Parse email address object
   * @param {Object} address - Address object from mailparser
   * @returns {Object} Normalized address
   */
  parseAddress(address) {
    if (!address) return { name: 'Unknown', email: 'unknown@example.com' };
    
    if (address.value && Array.isArray(address.value)) {
      const first = address.value[0];
      return {
        name: first.name || first.address.split('@')[0],
        email: first.address.toLowerCase()
      };
    }
    
    if (address.text) {
      return this.parseEmailString(address.text);
    }
    
    return { name: 'Unknown', email: 'unknown@example.com' };
  }

  /**
   * Parse multiple email addresses
   * @param {Object} addresses - Addresses from mailparser
   * @returns {Array} Array of normalized addresses
   */
  parseAddresses(addresses) {
    if (!addresses) return [];
    
    if (addresses.value && Array.isArray(addresses.value)) {
      return addresses.value.map(addr => ({
        name: addr.name || addr.address.split('@')[0],
        email: addr.address.toLowerCase()
      }));
    }
    
    if (addresses.text) {
      return [this.parseEmailString(addresses.text)];
    }
    
    return [];
  }

  /**
   * Parse email string format "Name <email@domain.com>"
   * @param {string} emailString - Email string
   * @returns {Object} Parsed address
   */
  parseEmailString(emailString) {
    if (!emailString) return { name: 'Unknown', email: 'unknown@example.com' };
    
    const match = emailString.match(/^(.+?)\s*<(.+?)>$/) || emailString.match(/^(.+)$/);
    
    if (match && match.length > 2) {
      // Format: "Name <email@domain.com>"
      return {
        name: match[1].trim().replace(/"/g, ''),
        email: match[2].trim().toLowerCase()
      };
    } else if (match && match[1].includes('@')) {
      // Format: "email@domain.com"
      const email = match[1].trim().toLowerCase();
      return {
        name: email.split('@')[0],
        email: email
      };
    }
    
    return { name: 'Unknown', email: 'unknown@example.com' };
  }

  /**
   * Extract important headers for analysis
   * @param {Map} headers - Headers from mailparser
   * @returns {Object} Important headers
   */
  extractImportantHeaders(headers) {
    const important = {};
    
    // Headers that might be useful for filtering/analysis
    const relevantHeaders = [
      'list-unsubscribe',
      'list-id',
      'x-mailer',
      'x-originating-ip',
      'return-path',
      'reply-to',
      'x-campaign-id',
      'x-mailgun-variables'
    ];
    
    if (headers) {
      relevantHeaders.forEach(header => {
        const value = headers.get(header);
        if (value) {
          important[header] = value;
        }
      });
    }
    
    return important;
  }

  /**
   * Process email attachments
   * @param {Array} attachments - Attachments from mailparser
   * @returns {Array} Processed attachments
   */
  processAttachments(attachments) {
    return attachments.map(attachment => ({
      filename: attachment.filename || 'unknown',
      contentType: attachment.contentType || 'application/octet-stream',
      size: attachment.size || 0,
      contentId: attachment.contentId,
      cid: attachment.cid,
      // Don't include actual content for security/performance reasons
      hasContent: !!attachment.content
    }));
  }

  /**
   * Extract base URL from email domain
   * @param {string} email - Email address
   * @returns {string} Base URL
   */
  extractBaseUrl(email) {
    try {
      const domain = email.split('@')[1];
      return `https://${domain}`;
    } catch {
      return '';
    }
  }

  /**
   * Validate parsing performance
   * @param {number} processingTime - Time taken to process
   * @param {number} contentSize - Size of content processed
   * @returns {Object} Performance metrics
   */
  validatePerformance(processingTime, contentSize) {
    const sizeKB = contentSize / 1024;
    const performanceRating = processingTime < 2000 ? 'good' : 
                             processingTime < 5000 ? 'acceptable' : 'poor';
    
    return {
      processingTime,
      contentSizeKB: Math.round(sizeKB),
      performanceRating,
      meetsRequirements: processingTime < 2000 // <2s requirement
    };
  }
}

module.exports = EmailParser;