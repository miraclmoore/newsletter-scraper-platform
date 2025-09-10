const emailValidator = require('../validator');

describe('EmailValidator', () => {
  beforeEach(() => {
    // Reset rate limiting between tests
    emailValidator.domainCounts.clear();
  });

  describe('validateEmail', () => {
    test('should validate legitimate newsletter email', async () => {
      const emailData = {
        from: [{ name: 'Newsletter Team', address: 'newsletter@substack.com', domain: 'substack.com' }],
        to: [{ address: 'user123@newsletters.app' }],
        subject: 'Weekly Newsletter #45',
        text: 'Newsletter content with unsubscribe link',
        html: '<p>Newsletter content</p><p>Click to unsubscribe</p>',
        attachments: []
      };

      const result = await emailValidator.validateEmail(emailData, 'user123@newsletters.app');

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.riskLevel).toBe('low');
      expect(result.checks.hasValidSender.valid).toBe(true);
      expect(result.checks.hasValidSender.trusted).toBe(true);
      expect(result.checks.hasValidRecipient.valid).toBe(true);
      expect(result.checks.isNewsletterLike.isNewsletterLike).toBe(true);
      expect(result.checks.spamScore.isSpammy).toBe(false);
    });

    test('should reject email with invalid sender', async () => {
      const emailData = {
        from: [{ address: 'suspicious123456789@temp-domain.temp', domain: 'temp-domain.temp' }],
        to: [{ address: 'user123@newsletters.app' }],
        subject: 'URGENT!!! ACT NOW!!!',
        text: 'Make money fast! Click here now!',
        attachments: []
      };

      const result = await emailValidator.validateEmail(emailData, 'user123@newsletters.app');

      expect(result.isValid).toBe(false);
      expect(result.riskLevel).toBe('high');
      expect(result.checks.spamScore.isSpammy).toBe(true);
      expect(result.reason).toContain('failed validation');
    });

    test('should reject email with mismatched recipient', async () => {
      const emailData = {
        from: [{ address: 'newsletter@example.com', domain: 'example.com' }],
        to: [{ address: 'wrong@newsletters.app' }],
        subject: 'Newsletter',
        text: 'Content',
        attachments: []
      };

      const result = await emailValidator.validateEmail(emailData, 'correct@newsletters.app');

      expect(result.isValid).toBe(false);
      expect(result.checks.hasValidRecipient.valid).toBe(false);
    });

    test('should handle rate limiting', async () => {
      const emailData = {
        from: [{ address: 'test@example.com', domain: 'example.com' }],
        to: [{ address: 'user@newsletters.app' }],
        subject: 'Newsletter',
        text: 'Content',
        attachments: []
      };

      // Send 10 emails (at the limit)
      for (let i = 0; i < 10; i++) {
        const result = await emailValidator.validateEmail(emailData, 'user@newsletters.app');
        expect(result.checks.rateLimitOk.valid).toBe(true);
      }

      // 11th email should be rate limited
      const result = await emailValidator.validateEmail(emailData, 'user@newsletters.app');
      expect(result.checks.rateLimitOk.valid).toBe(false);
      expect(result.checks.rateLimitOk.reason).toContain('Rate limit exceeded');
    });
  });

  describe('validateSender', () => {
    test('should validate trusted domain sender', () => {
      const emailData = {
        from: [{ name: 'Newsletter', address: 'weekly@substack.com', domain: 'substack.com' }]
      };

      const result = emailValidator.validateSender(emailData);

      expect(result.valid).toBe(true);
      expect(result.trusted).toBe(true);
      expect(result.domain).toBe('substack.com');
    });

    test('should detect newsletter-like sender', () => {
      const emailData = {
        from: [{ name: 'Weekly Newsletter', address: 'updates@company.com', domain: 'company.com' }]
      };

      const result = emailValidator.validateSender(emailData);

      expect(result.valid).toBe(true);
      expect(result.newsletterLike).toBe(true);
      expect(result.senderName).toBe('Weekly Newsletter');
    });

    test('should reject suspicious sender patterns', () => {
      const emailData = {
        from: [{ address: 'a1234567890123456789@temp.temp', domain: 'temp.temp' }]
      };

      const result = emailValidator.validateSender(emailData);

      expect(result.valid).toBe(false);
    });

    test('should handle missing sender', () => {
      const emailData = { from: null };

      const result = emailValidator.validateSender(emailData);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('No sender address');
    });
  });

  describe('validateRecipient', () => {
    test('should validate matching recipient', () => {
      const emailData = {
        to: [
          { address: 'user123@newsletters.app' },
          { address: 'other@example.com' }
        ]
      };

      const result = emailValidator.validateRecipient(emailData, 'user123@newsletters.app');

      expect(result.valid).toBe(true);
      expect(result.matchedAddress).toBe('user123@newsletters.app');
    });

    test('should reject non-matching recipient', () => {
      const emailData = {
        to: [{ address: 'wrong@newsletters.app' }]
      };

      const result = emailValidator.validateRecipient(emailData, 'correct@newsletters.app');

      expect(result.valid).toBe(false);
    });

    test('should handle missing recipients', () => {
      const emailData = { to: null };

      const result = emailValidator.validateRecipient(emailData, 'user@newsletters.app');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('No recipient address');
    });
  });

  describe('checkNewsletterCharacteristics', () => {
    test('should identify newsletter by subject', () => {
      const emailData = {
        subject: 'Weekly Newsletter Issue #45',
        text: 'Content here',
        html: '<p>Content</p>'
      };

      const result = emailValidator.checkNewsletterCharacteristics(emailData);

      expect(result.isNewsletterLike).toBe(true);
      expect(result.score).toBeGreaterThan(2);
      expect(result.indicators.hasNewsletterSubject).toBe(true);
    });

    test('should identify newsletter by unsubscribe content', () => {
      const emailData = {
        subject: 'Company Updates',
        text: 'Updates content with substantial text here. '.repeat(10) + 'Click here to unsubscribe from future emails.',
        html: '<p>Updates</p><p>' + 'More content here. '.repeat(20) + '</p><a href="/unsubscribe">Unsubscribe</a>'
      };

      const result = emailValidator.checkNewsletterCharacteristics(emailData);

      expect(result.isNewsletterLike).toBe(true);
      expect(result.indicators.hasUnsubscribe).toBe(true);
      expect(result.indicators.hasSubstantialContent).toBe(true);
    });

    test('should not identify short emails as newsletters', () => {
      const emailData = {
        subject: 'Hi',
        text: 'Short message',
        html: ''
      };

      const result = emailValidator.checkNewsletterCharacteristics(emailData);

      expect(result.isNewsletterLike).toBe(false);
      expect(result.score).toBeLessThan(3);
    });
  });

  describe('calculateSpamScore', () => {
    test('should detect spam keywords', () => {
      const emailData = {
        subject: 'URGENT! ACT NOW! FREE MONEY!',
        text: 'Make money fast! No obligation! Amazing deal!',
        html: ''
      };

      const result = emailValidator.calculateSpamScore(emailData);

      expect(result.isSpammy).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.riskLevel).toBe('high');
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    test('should detect excessive punctuation', () => {
      const emailData = {
        subject: 'Important News!!!',
        text: 'Regular content',
        html: ''
      };

      const result = emailValidator.calculateSpamScore(emailData);

      expect(result.reasons).toContain('Excessive punctuation in subject');
    });

    test('should detect all caps subject', () => {
      const emailData = {
        subject: 'URGENT NEWSLETTER UPDATE NOW',
        text: 'Content',
        html: ''
      };

      const result = emailValidator.calculateSpamScore(emailData);

      expect(result.reasons).toContain('All caps subject line');
    });

    test('should score clean content as low risk', () => {
      const emailData = {
        subject: 'Weekly Newsletter',
        text: 'Quality newsletter content with useful information.',
        html: '<p>Quality content</p>'
      };

      const result = emailValidator.calculateSpamScore(emailData);

      expect(result.isSpammy).toBe(false);
      expect(result.score).toBe(0);
      expect(result.riskLevel).toBe('low');
    });
  });

  describe('checkRateLimit', () => {
    test('should allow emails within rate limit', () => {
      const emailData = {
        from: [{ domain: 'example.com' }]
      };

      const result = emailValidator.checkRateLimit(emailData);

      expect(result.valid).toBe(true);
      expect(result.currentCount).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.domain).toBe('example.com');
    });

    test('should track separate counts per domain', () => {
      const emailData1 = { from: [{ domain: 'domain1.com' }] };
      const emailData2 = { from: [{ domain: 'domain2.com' }] };

      emailValidator.checkRateLimit(emailData1);
      emailValidator.checkRateLimit(emailData1);
      const result1 = emailValidator.checkRateLimit(emailData1);

      const result2 = emailValidator.checkRateLimit(emailData2);

      expect(result1.currentCount).toBe(3);
      expect(result2.currentCount).toBe(1);
    });

    test('should handle missing sender domain', () => {
      const emailData = { from: [{}] };

      const result = emailValidator.checkRateLimit(emailData);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('No sender domain');
    });
  });

  describe('isTrustedNewsletterDomain', () => {
    test('should recognize newsletter service patterns', () => {
      expect(emailValidator.isTrustedNewsletterDomain('company.substack.com')).toBe(true);
      expect(emailValidator.isTrustedNewsletterDomain('blog.ghost.io')).toBe(true);
      expect(emailValidator.isTrustedNewsletterDomain('mail.company.com')).toBe(true);
      expect(emailValidator.isTrustedNewsletterDomain('newsletter.startup.com')).toBe(true);
    });

    test('should not recognize non-newsletter domains', () => {
      expect(emailValidator.isTrustedNewsletterDomain('spam.com')).toBe(false);
      expect(emailValidator.isTrustedNewsletterDomain('random-domain.org')).toBe(false);
    });
  });

  describe('checkSuspiciousSenderPatterns', () => {
    test('should detect suspicious patterns', () => {
      const suspiciousPatterns = [
        { address: 'noreply@domain.temp' },
        { address: 'abcdefghijklmnopqrstuvwxyz@example.com' },
        { address: 'a1234567890@example.com' }
      ];

      suspiciousPatterns.forEach(fromInfo => {
        const result = emailValidator.checkSuspiciousSenderPatterns(fromInfo);
        expect(result).toBe(true);
      });
    });

    test('should not flag legitimate senders', () => {
      const legitimatePatterns = [
        { address: 'newsletter@company.com' },
        { address: 'updates@startup.io' },
        { name: 'Newsletter Team', address: 'team@example.com' }
      ];

      legitimatePatterns.forEach(fromInfo => {
        const result = emailValidator.checkSuspiciousSenderPatterns(fromInfo);
        expect(result).toBe(false);
      });
    });
  });

  describe('generateEmailSignature', () => {
    test('should generate consistent signatures', () => {
      const emailData = {
        messageId: 'test@example.com',
        from: [{ address: 'sender@example.com' }],
        subject: 'Test Subject',
        date: new Date('2024-01-01T12:00:00Z')
      };
      const secret = 'test-secret';

      const signature1 = emailValidator.generateEmailSignature(emailData, secret);
      const signature2 = emailValidator.generateEmailSignature(emailData, secret);

      expect(signature1).toBe(signature2);
      expect(signature1).toHaveLength(64); // SHA-256 hex length
    });

    test('should generate different signatures for different data', () => {
      const emailData1 = {
        messageId: 'test1@example.com',
        from: [{ address: 'sender@example.com' }],
        subject: 'Subject 1',
        date: new Date('2024-01-01T12:00:00Z')
      };
      const emailData2 = {
        messageId: 'test2@example.com',
        from: [{ address: 'sender@example.com' }],
        subject: 'Subject 2',
        date: new Date('2024-01-01T12:00:00Z')
      };
      const secret = 'test-secret';

      const signature1 = emailValidator.generateEmailSignature(emailData1, secret);
      const signature2 = emailValidator.generateEmailSignature(emailData2, secret);

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('verifyEmailSignature', () => {
    test('should verify valid signatures', () => {
      const emailData = {
        messageId: 'test@example.com',
        from: [{ address: 'sender@example.com' }],
        subject: 'Test Subject',
        date: new Date('2024-01-01T12:00:00Z')
      };
      const secret = 'test-secret';

      const signature = emailValidator.generateEmailSignature(emailData, secret);
      const isValid = emailValidator.verifyEmailSignature(emailData, signature, secret);

      expect(isValid).toBe(true);
    });

    test('should reject invalid signatures', () => {
      const emailData = {
        messageId: 'test@example.com',
        from: [{ address: 'sender@example.com' }],
        subject: 'Test Subject',
        date: new Date('2024-01-01T12:00:00Z')
      };
      const secret = 'test-secret';
      
      // Generate a valid signature then modify it to be wrong length
      const validSignature = emailValidator.generateEmailSignature(emailData, secret);
      const wrongSignature = validSignature.substring(0, 32); // Make it wrong length

      try {
        const isValid = emailValidator.verifyEmailSignature(emailData, wrongSignature, secret);
        expect(isValid).toBe(false);
      } catch (error) {
        // Should throw error for different length buffers
        expect(error.message).toContain('same byte length');
      }
    });
  });
});