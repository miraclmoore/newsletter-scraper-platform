const { simpleParser } = require('mailparser');
const { convert } = require('html-to-text');
const crypto = require('crypto');

class EmailParser {
  constructor() {
    this.htmlToTextOptions = {
      wordwrap: 130,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'table', format: 'block' },
        { selector: '.header', format: 'skip' },
        { selector: '.footer', format: 'skip' },
        { selector: '[style*="display: none"]', format: 'skip' },
        { selector: '[style*="display:none"]', format: 'skip' }
      ],
      tags: {
        'h1': { options: { uppercase: false } },
        'h2': { options: { uppercase: false } },
        'h3': { options: { uppercase: false } },
        'p': { format: 'paragraph' },
        'br': { format: 'lineBreak' },
        'hr': { format: 'horizontalLine' }
      }
    };
  }

  /**
   * Parse raw email content into structured data
   * @param {string|Buffer} rawEmail - Raw email content
   * @returns {Object} Parsed email data
   */
  async parseEmail(rawEmail) {
    try {
      const parsed = await simpleParser(rawEmail);
      
      const emailData = {
        messageId: parsed.messageId,
        subject: parsed.subject || '',
        from: this.extractEmailInfo(parsed.from),
        to: this.extractEmailInfo(parsed.to),
        date: parsed.date || new Date(),
        headers: parsed.headers,
        html: parsed.html || '',
        text: parsed.text || '',
        attachments: parsed.attachments || []
      };

      // Extract clean content
      const cleanContent = this.extractCleanContent(emailData);
      
      // Generate metadata
      const metadata = this.generateMetadata(emailData, cleanContent);

      return {
        ...emailData,
        cleanContent,
        metadata,
        parsedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Email parsing failed: ${error.message}`);
    }
  }

  /**
   * Extract clean, readable content from email
   * @param {Object} emailData - Parsed email data
   * @returns {Object} Clean content object
   */
  extractCleanContent(emailData) {
    let content = '';
    let title = emailData.subject || '';

    // Use HTML content if available, fallback to text
    if (emailData.html) {
      content = this.htmlToCleanText(emailData.html);
    } else if (emailData.text) {
      content = this.cleanPlainText(emailData.text);
    }

    // Clean and normalize title
    title = this.cleanTitle(title);

    return {
      title,
      content: content.trim(),
      wordCount: content.split(/\s+/).length,
      estimatedReadTime: Math.ceil(content.split(/\s+/).length / 200) // 200 WPM
    };
  }

  /**
   * Convert HTML to clean text
   * @param {string} html - HTML content
   * @returns {string} Clean text
   */
  htmlToCleanText(html) {
    try {
      // Remove tracking pixels and common newsletter cruft
      let cleanHtml = html
        .replace(/<img[^>]*1x1[^>]*>/gi, '') // Remove 1x1 tracking pixels
        .replace(/<img[^>]*tracking[^>]*>/gi, '') // Remove tracking images
        .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
        .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[\s\S]*?<\/style>/gi, '') // Remove styles
        .replace(/<head[\s\S]*?<\/head>/gi, '') // Remove head section
        .replace(/style\s*=\s*"[^"]*"/gi, '') // Remove inline styles
        .replace(/class\s*=\s*"[^"]*"/gi, '') // Remove class attributes
        .replace(/id\s*=\s*"[^"]*"/gi, ''); // Remove id attributes

      // Convert to text
      const text = convert(cleanHtml, this.htmlToTextOptions);
      
      return this.cleanPlainText(text);
    } catch (error) {
      console.warn('HTML to text conversion failed:', error.message);
      return this.cleanPlainText(html.replace(/<[^>]*>/g, ''));
    }
  }

  /**
   * Clean plain text content
   * @param {string} text - Plain text content
   * @returns {string} Cleaned text
   */
  cleanPlainText(text) {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Reduce excessive line breaks
      .replace(/^\s+|\s+$/gm, '') // Trim lines
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&[a-z]+;/gi, '') // Remove HTML entities
      .replace(/\*{2,}/g, '') // Remove excessive asterisks
      .replace(/_{2,}/g, '') // Remove excessive underscores
      .replace(/={2,}/g, '') // Remove excessive equals signs
      .replace(/^View this email in your browser.*$/im, '') // Remove common headers
      .replace(/^Unsubscribe.*$/im, '') // Remove unsubscribe lines
      .replace(/^If you no longer wish to receive.*$/im, '') // Remove opt-out text
      .trim();
  }

  /**
   * Clean email subject/title
   * @param {string} title - Raw title
   * @returns {string} Cleaned title
   */
  cleanTitle(title) {
    return title
      .replace(/^(RE:|FW:|FWD:)\s*/i, '') // Remove reply/forward prefixes
      .replace(/\[.*?\]/g, '') // Remove bracketed content
      .replace(/^\d+[\.\)]\s*/, '') // Remove leading numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract email address information
   * @param {Object|Array} emailField - Email field from parsed email
   * @returns {Object} Extracted email info
   */
  extractEmailInfo(emailField) {
    if (!emailField) return null;

    const addresses = Array.isArray(emailField) ? emailField : [emailField];
    
    return addresses.map(addr => ({
      name: addr.name || '',
      address: addr.address || '',
      domain: addr.address ? addr.address.split('@')[1] : ''
    }));
  }

  /**
   * Generate metadata about the email
   * @param {Object} emailData - Parsed email data
   * @param {Object} cleanContent - Clean content object
   * @returns {Object} Metadata object
   */
  generateMetadata(emailData, cleanContent) {
    const fromInfo = emailData.from && emailData.from[0];
    const domain = fromInfo ? fromInfo.domain : '';
    
    return {
      senderDomain: domain,
      senderName: fromInfo ? fromInfo.name : '',
      hasAttachments: emailData.attachments.length > 0,
      attachmentCount: emailData.attachments.length,
      wordCount: cleanContent.wordCount,
      estimatedReadTime: cleanContent.estimatedReadTime,
      messageId: emailData.messageId,
      originalSubject: emailData.subject,
      parsedAt: new Date().toISOString(),
      contentType: emailData.html ? 'html' : 'text',
      size: this.estimateSize(emailData),
      language: this.detectLanguage(cleanContent.content),
      isNewsletter: this.isLikelyNewsletter(emailData, cleanContent)
    };
  }

  /**
   * Estimate email size in bytes
   * @param {Object} emailData - Parsed email data
   * @returns {number} Estimated size
   */
  estimateSize(emailData) {
    const textSize = (emailData.text || '').length;
    const htmlSize = (emailData.html || '').length;
    const attachmentSize = emailData.attachments.reduce((size, att) => size + (att.size || 0), 0);
    
    return textSize + htmlSize + attachmentSize;
  }

  /**
   * Simple language detection (English vs non-English)
   * @param {string} content - Text content
   * @returns {string} Detected language
   */
  detectLanguage(content) {
    // Simple heuristic: check for common English words
    const englishWords = ['the', 'and', 'for', 'you', 'with', 'this', 'that', 'from', 'have', 'will'];
    const words = content.toLowerCase().split(/\s+/);
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    const ratio = englishCount / Math.min(words.length, 100);
    
    return ratio > 0.1 ? 'en' : 'unknown';
  }

  /**
   * Determine if email is likely a newsletter
   * @param {Object} emailData - Parsed email data
   * @param {Object} cleanContent - Clean content object
   * @returns {boolean} Whether email appears to be a newsletter
   */
  isLikelyNewsletter(emailData, cleanContent) {
    const subject = (emailData.subject || '').toLowerCase();
    const content = cleanContent.content.toLowerCase();
    
    // Newsletter indicators
    const newsletterKeywords = [
      'newsletter', 'digest', 'weekly', 'monthly', 'update', 'bulletin',
      'roundup', 'briefing', 'summary', 'edition', 'issue', 'volume'
    ];
    
    const unsubscribeKeywords = ['unsubscribe', 'opt out', 'manage preferences'];
    
    // Check for newsletter keywords in subject
    const hasNewsletterSubject = newsletterKeywords.some(keyword => 
      subject.includes(keyword)
    );
    
    // Check for unsubscribe content (common in newsletters)
    const hasUnsubscribe = unsubscribeKeywords.some(keyword => 
      content.includes(keyword)
    );
    
    // Check content length (newsletters are usually substantial)
    const hasSubstantialContent = cleanContent.wordCount > 50;
    
    // Check for list-style content (common in newsletters)
    const hasListContent = content.includes('•') || 
                          content.includes('*') || 
                          /\d+\.\s/.test(content);
    
    return hasNewsletterSubject || 
           (hasUnsubscribe && hasSubstantialContent) ||
           (hasListContent && hasSubstantialContent && hasUnsubscribe);
  }

  /**
   * Extract links from email content
   * @param {string} html - HTML content
   * @returns {Array} Array of extracted links
   */
  extractLinks(html) {
    if (!html) return [];
    
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    const links = [];
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const text = match[2].trim();
      
      // Skip tracking and unsubscribe links
      if (!url.includes('unsubscribe') && 
          !url.includes('tracking') && 
          !url.includes('pixel') &&
          text.length > 0) {
        links.push({
          url: this.cleanUrl(url),
          text: text
        });
      }
    }
    
    return links.slice(0, 20); // Limit to 20 links
  }

  /**
   * Clean and normalize URL
   * @param {string} url - Raw URL
   * @returns {string} Cleaned URL
   */
  cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove common tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      trackingParams.forEach(param => urlObj.searchParams.delete(param));
      return urlObj.toString();
    } catch (error) {
      return url;
    }
  }
}

module.exports = new EmailParser();