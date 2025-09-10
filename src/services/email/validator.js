const crypto = require('crypto');

class EmailValidator {
  constructor() {
    // Newsletter sender patterns (domains and keywords that indicate legitimate newsletters)
    this.trustedDomains = new Set([
      'substack.com',
      'buttondown.email',
      'convertkit.com',
      'mailchimp.com',
      'constantcontact.com',
      'aweber.com',
      'getresponse.com',
      'activecampaign.com',
      'campaignmonitor.com',
      'sendinblue.com',
      'newsletter.com',
      'beehiiv.com',
      'ghost.org'
    ]);

    // Common newsletter keywords in sender names
    this.newsletterKeywords = [
      'newsletter', 'news', 'digest', 'weekly', 'daily', 'update', 
      'bulletin', 'briefing', 'report', 'journal', 'magazine',
      'blog', 'post', 'dispatch', 'roundup', 'summary'
    ];

    // Spam indicators
    this.spamKeywords = [
      'urgent', 'act now', 'limited time', 'free money', 'make money fast',
      'click here now', 'congratulations', 'you have won', 'claim now',
      'no obligation', 'risk free', 'guarantee', 'amazing deal'
    ];

    // Rate limiting: store recent send counts per domain
    this.domainCounts = new Map();
    this.resetInterval = 60 * 1000; // Reset counts every minute
    
    setInterval(() => {
      this.domainCounts.clear();
    }, this.resetInterval);
  }

  /**
   * Validate if email should be processed as a newsletter
   * @param {Object} emailData - Parsed email data
   * @param {string} forwardingAddress - User's forwarding address
   * @returns {Object} Validation result
   */
  async validateEmail(emailData, forwardingAddress) {
    const validationResult = {
      isValid: true,
      reason: null,
      confidence: 0,
      riskLevel: 'low', // low, medium, high
      checks: {}
    };

    try {
      // Basic validation checks
      validationResult.checks.hasValidSender = this.validateSender(emailData);
      validationResult.checks.hasValidRecipient = this.validateRecipient(emailData, forwardingAddress);
      validationResult.checks.isNewsletterLike = this.checkNewsletterCharacteristics(emailData);
      validationResult.checks.spamScore = this.calculateSpamScore(emailData);
      validationResult.checks.rateLimitOk = this.checkRateLimit(emailData);
      validationResult.checks.hasValidContent = this.validateContent(emailData);

      // Calculate overall confidence and validity
      const result = this.calculateOverallValidity(validationResult.checks);
      validationResult.isValid = result.isValid;
      validationResult.confidence = result.confidence;
      validationResult.riskLevel = result.riskLevel;
      validationResult.reason = result.reason;

      return validationResult;
    } catch (error) {
      console.error('Email validation error:', error);
      return {
        isValid: false,
        reason: 'Validation error: ' + error.message,
        confidence: 0,
        riskLevel: 'high',
        checks: {}
      };
    }
  }

  /**
   * Validate email sender
   * @param {Object} emailData - Parsed email data
   * @returns {Object} Sender validation result
   */
  validateSender(emailData) {
    const fromInfo = emailData.from && emailData.from[0];
    
    if (!fromInfo || !fromInfo.address) {
      return { valid: false, reason: 'No sender address' };
    }

    const domain = fromInfo.domain;
    const senderName = (fromInfo.name || '').toLowerCase();
    const senderAddress = fromInfo.address.toLowerCase();

    // Check for trusted domains
    const isTrustedDomain = this.trustedDomains.has(domain) ||
                           this.isTrustedNewsletterDomain(domain);

    // Check for newsletter keywords in sender name
    const hasNewsletterKeywords = this.newsletterKeywords.some(keyword =>
      senderName.includes(keyword) || senderAddress.includes(keyword)
    );

    // Check for suspicious patterns
    const hasSuspiciousPatterns = this.checkSuspiciousSenderPatterns(fromInfo);

    return {
      valid: !hasSuspiciousPatterns,
      trusted: isTrustedDomain,
      newsletterLike: hasNewsletterKeywords,
      domain: domain,
      senderName: fromInfo.name,
      senderAddress: fromInfo.address
    };
  }

  /**
   * Check if domain appears to be a legitimate newsletter service
   * @param {string} domain - Sender domain
   * @returns {boolean} Whether domain is trusted
   */
  isTrustedNewsletterDomain(domain) {
    // Check for common newsletter service patterns
    const newsletterServicePatterns = [
      /\.substack\.com$/,
      /\.ghost\.io$/,
      /\.beehiiv\.com$/,
      /mail\..*\.com$/,
      /newsletter\..*$/,
      /updates\..*$/,
      /news\..*$/
    ];

    return newsletterServicePatterns.some(pattern => pattern.test(domain));
  }

  /**
   * Check for suspicious sender patterns
   * @param {Object} fromInfo - Sender information
   * @returns {boolean} Whether sender appears suspicious
   */
  checkSuspiciousSenderPatterns(fromInfo) {
    const senderName = (fromInfo.name || '').toLowerCase();
    const senderAddress = fromInfo.address.toLowerCase();

    // Red flags
    const redFlags = [
      /noreply@.*\.temp$/,
      /no-reply@.*\.temp$/,
      /^[a-z0-9]{20,}@/, // Very long random-looking local part
      /\d{10,}/, // Long sequences of numbers
      /[a-z]{1,2}\d{8,}@/ // Short letters followed by long numbers
    ];

    return redFlags.some(pattern => 
      pattern.test(senderAddress) || pattern.test(senderName)
    );
  }

  /**
   * Validate recipient matches forwarding address
   * @param {Object} emailData - Parsed email data
   * @param {string} forwardingAddress - Expected forwarding address
   * @returns {Object} Recipient validation result
   */
  validateRecipient(emailData, forwardingAddress) {
    const toInfo = emailData.to;
    
    if (!toInfo || !Array.isArray(toInfo) || toInfo.length === 0) {
      return { valid: false, reason: 'No recipient address' };
    }

    const hasMatchingRecipient = toInfo.some(recipient => 
      recipient.address && recipient.address.toLowerCase() === forwardingAddress.toLowerCase()
    );

    return {
      valid: hasMatchingRecipient,
      recipients: toInfo.map(r => r.address),
      matchedAddress: forwardingAddress
    };
  }

  /**
   * Check newsletter characteristics
   * @param {Object} emailData - Parsed email data
   * @returns {Object} Newsletter characteristics result
   */
  checkNewsletterCharacteristics(emailData) {
    const subject = (emailData.subject || '').toLowerCase();
    const content = ((emailData.text || '') + (emailData.html || '')).toLowerCase();

    // Positive newsletter indicators
    const positiveIndicators = [
      // Subject indicators
      subject.includes('newsletter'),
      subject.includes('digest'),
      subject.includes('weekly'),
      subject.includes('monthly'),
      subject.includes('update'),
      /issue\s*#?\d+/.test(subject),
      /vol(ume)?\s*\d+/.test(subject),
      
      // Content indicators
      content.includes('unsubscribe'),
      content.includes('manage preferences'),
      content.includes('view in browser'),
      content.includes('forward to a friend'),
      content.length > 500, // Substantial content
      
      // HTML structure indicators (for newsletters)
      emailData.html && emailData.html.includes('<table'), // HTML tables common in newsletters
      emailData.html && emailData.html.includes('newsletter'),
    ];

    const score = positiveIndicators.filter(Boolean).length;
    const maxScore = positiveIndicators.length;

    return {
      score: score,
      maxScore: maxScore,
      percentage: (score / maxScore) * 100,
      isNewsletterLike: score >= 3, // At least 3 positive indicators
      indicators: {
        hasNewsletterSubject: subject.includes('newsletter'),
        hasUnsubscribe: content.includes('unsubscribe'),
        hasSubstantialContent: content.length > 500,
        hasHtmlStructure: emailData.html && emailData.html.includes('<table')
      }
    };
  }

  /**
   * Calculate spam score
   * @param {Object} emailData - Parsed email data
   * @returns {Object} Spam score result
   */
  calculateSpamScore(emailData) {
    const originalSubject = emailData.subject || '';
    const subject = originalSubject.toLowerCase();
    const content = ((emailData.text || '') + (emailData.html || '')).toLowerCase();
    
    let spamScore = 0;
    const reasons = [];

    // Check for spam keywords
    this.spamKeywords.forEach(keyword => {
      if (subject.includes(keyword) || content.includes(keyword)) {
        spamScore += 1;
        reasons.push(`Contains spam keyword: ${keyword}`);
      }
    });

    // Check for excessive punctuation
    if (/!{3,}/.test(originalSubject) || /\?{3,}/.test(originalSubject)) {
      spamScore += 1;
      reasons.push('Excessive punctuation in subject');
    }

    // Check for all caps subject
    if (originalSubject.length > 10 && originalSubject === originalSubject.toUpperCase()) {
      spamScore += 1;
      reasons.push('All caps subject line');
    }

    // Check for suspicious links
    if (emailData.html) {
      const linkCount = (emailData.html.match(/<a[^>]+href/gi) || []).length;
      if (linkCount > 20) {
        spamScore += 1;
        reasons.push('Excessive number of links');
      }
    }

    return {
      score: spamScore,
      isSpammy: spamScore >= 3,
      riskLevel: spamScore >= 3 ? 'high' : spamScore >= 1 ? 'medium' : 'low',
      reasons: reasons
    };
  }

  /**
   * Check rate limiting
   * @param {Object} emailData - Parsed email data
   * @returns {Object} Rate limit result
   */
  checkRateLimit(emailData) {
    const fromInfo = emailData.from && emailData.from[0];
    if (!fromInfo || !fromInfo.domain) {
      return { valid: false, reason: 'No sender domain' };
    }

    const domain = fromInfo.domain;
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const key = `${domain}:${minute}`;

    // Get current count for this domain in this minute
    const currentCount = this.domainCounts.get(key) || 0;
    const newCount = currentCount + 1;
    
    // Set limits: max 10 emails per minute per domain
    const maxPerMinute = 10;
    const isWithinLimit = newCount <= maxPerMinute;

    if (isWithinLimit) {
      this.domainCounts.set(key, newCount);
    }

    return {
      valid: isWithinLimit,
      currentCount: newCount,
      limit: maxPerMinute,
      domain: domain,
      reason: isWithinLimit ? null : `Rate limit exceeded for domain ${domain}`
    };
  }

  /**
   * Validate email content
   * @param {Object} emailData - Parsed email data
   * @returns {Object} Content validation result
   */
  validateContent(emailData) {
    const hasContent = (emailData.text && emailData.text.trim().length > 0) ||
                      (emailData.html && emailData.html.trim().length > 0);

    const hasSubject = emailData.subject && emailData.subject.trim().length > 0;
    
    const contentLength = (emailData.text || '').length + (emailData.html || '').length;
    const hasSubstantialContent = contentLength > 100;

    return {
      valid: hasContent && hasSubject,
      hasSubject: hasSubject,
      hasContent: hasContent,
      hasSubstantialContent: hasSubstantialContent,
      contentLength: contentLength
    };
  }

  /**
   * Calculate overall validity based on all checks
   * @param {Object} checks - All validation checks
   * @returns {Object} Overall validity result
   */
  calculateOverallValidity(checks) {
    let score = 0;
    let maxScore = 0;
    const issues = [];

    // Sender validation (weight: 3)
    maxScore += 3;
    if (checks.hasValidSender && checks.hasValidSender.valid) {
      score += checks.hasValidSender.trusted ? 3 : 2;
    } else {
      issues.push('Invalid sender');
    }

    // Recipient validation (weight: 2)
    maxScore += 2;
    if (checks.hasValidRecipient && checks.hasValidRecipient.valid) {
      score += 2;
    } else {
      issues.push('Invalid recipient');
    }

    // Newsletter characteristics (weight: 2)
    maxScore += 2;
    if (checks.isNewsletterLike && checks.isNewsletterLike.isNewsletterLike) {
      score += 2;
    } else if (checks.isNewsletterLike && checks.isNewsletterLike.score > 0) {
      score += 1;
    }

    // Spam score (weight: 2, reverse scoring)
    maxScore += 2;
    if (checks.spamScore && !checks.spamScore.isSpammy) {
      score += 2;
    } else if (checks.spamScore && checks.spamScore.score <= 1) {
      score += 1;
    } else {
      issues.push('High spam score');
    }

    // Rate limit (weight: 1)
    maxScore += 1;
    if (checks.rateLimitOk && checks.rateLimitOk.valid) {
      score += 1;
    } else {
      issues.push('Rate limit exceeded');
    }

    // Content validation (weight: 1)
    maxScore += 1;
    if (checks.hasValidContent && checks.hasValidContent.valid) {
      score += 1;
    } else {
      issues.push('Invalid content');
    }

    const confidence = Math.round((score / maxScore) * 100);
    const isValid = confidence >= 70 && issues.length === 0;
    
    let riskLevel = 'low';
    if (confidence < 50 || issues.length > 2) {
      riskLevel = 'high';
    } else if (confidence < 70 || issues.length > 0) {
      riskLevel = 'medium';
    }

    return {
      isValid,
      confidence,
      riskLevel,
      reason: isValid ? 'Email passed validation' : `Email failed validation: ${issues.join(', ')}`,
      score,
      maxScore,
      issues
    };
  }

  /**
   * Generate email signature for verification
   * @param {Object} emailData - Parsed email data
   * @param {string} secret - Secret key for signing
   * @returns {string} Email signature
   */
  generateEmailSignature(emailData, secret) {
    const data = {
      messageId: emailData.messageId,
      from: emailData.from && emailData.from[0] ? emailData.from[0].address : '',
      subject: emailData.subject,
      date: emailData.date ? emailData.date.toISOString() : ''
    };
    
    const payload = JSON.stringify(data);
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify email signature
   * @param {Object} emailData - Parsed email data
   * @param {string} signature - Provided signature
   * @param {string} secret - Secret key for verification
   * @returns {boolean} Whether signature is valid
   */
  verifyEmailSignature(emailData, signature, secret) {
    const expectedSignature = this.generateEmailSignature(emailData, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}

module.exports = new EmailValidator();