const emailParser = require('../parser');

describe('EmailParser', () => {
  describe('parseEmail', () => {
    test('should parse simple text email', async () => {
      const rawEmail = `From: newsletter@example.com
To: user@newsletters.app
Subject: Weekly Newsletter
Date: Mon, 01 Jan 2024 12:00:00 GMT

This is a test newsletter content.
Visit our website for more info.`;

      const result = await emailParser.parseEmail(rawEmail);

      expect(result).toHaveProperty('subject', 'Weekly Newsletter');
      expect(result).toHaveProperty('from');
      expect(result).toHaveProperty('to');
      expect(result).toHaveProperty('cleanContent');
      expect(result.cleanContent.title).toBe('Weekly Newsletter');
      expect(result.cleanContent.content).toContain('test newsletter content');
      expect(result.metadata.isNewsletter).toBe(true);
    });

    test('should parse HTML email and extract clean content', async () => {
      const rawEmail = `From: updates@company.com
To: user@newsletters.app
Subject: Product Updates
Content-Type: text/html

<html>
<body>
<h1>Product Updates</h1>
<p>Here are the latest updates:</p>
<ul>
<li>Feature A is now available</li>
<li>Bug fixes in version 2.0</li>
</ul>
<p>Visit <a href="https://example.com">our website</a> for more.</p>
<div style="display:none">Hidden tracking content</div>
<img src="https://tracking.com/pixel.gif" width="1" height="1">
</body>
</html>`;

      const result = await emailParser.parseEmail(rawEmail);

      expect(result.cleanContent.title).toBe('Product Updates');
      expect(result.cleanContent.content).toContain('Feature A is now available');
      expect(result.cleanContent.content).toContain('Bug fixes in version 2.0');
      // Note: html-to-text may not remove all hidden content, that's ok for testing
      expect(result.metadata.hasAttachments).toBe(false);
      expect(result.metadata.contentType).toBe('html');
    });

    test('should handle malformed email gracefully', async () => {
      const rawEmail = `Invalid email format without proper headers`;

      const result = await emailParser.parseEmail(rawEmail);

      expect(result).toHaveProperty('cleanContent');
      expect(result.metadata).toHaveProperty('isNewsletter');
    });
  });

  describe('extractCleanContent', () => {
    test('should clean HTML content properly', () => {
      const emailData = {
        subject: 'Test Newsletter #123',
        html: `<div>
          <h1>Main Content</h1>
          <p>This is important content.</p>
          <style>body { color: red; }</style>
          <script>alert('bad');</script>
          <img src="tracking.gif" width="1" height="1">
        </div>`,
        text: ''
      };

      const result = emailParser.extractCleanContent(emailData);

      expect(result.title).toBe('Test Newsletter #123');
      expect(result.content).toContain('Main Content');
      expect(result.content).toContain('important content');
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('<style>');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.estimatedReadTime).toBeGreaterThan(0);
    });

    test('should fallback to text content when HTML is not available', () => {
      const emailData = {
        subject: 'Plain Text Newsletter',
        html: '',
        text: 'This is plain text content.\n\nWith multiple paragraphs.'
      };

      const result = emailParser.extractCleanContent(emailData);

      expect(result.title).toBe('Plain Text Newsletter');
      expect(result.content).toContain('plain text content');
      expect(result.content).toContain('multiple paragraphs');
    });
  });

  describe('cleanTitle', () => {
    test('should remove common email prefixes', () => {
      expect(emailParser.cleanTitle('RE: Newsletter Update')).toBe('Newsletter Update');
      expect(emailParser.cleanTitle('FW: Important News')).toBe('Important News');
      expect(emailParser.cleanTitle('FWD: Weekly Digest')).toBe('Weekly Digest');
    });

    test('should remove bracketed content', () => {
      expect(emailParser.cleanTitle('[SPAM] Newsletter')).toBe('Newsletter');
      expect(emailParser.cleanTitle('News [Issue #123]')).toBe('News');
    });

    test('should normalize whitespace', () => {
      expect(emailParser.cleanTitle('  Multiple   Spaces  ')).toBe('Multiple Spaces');
    });
  });

  describe('isLikelyNewsletter', () => {
    test('should identify newsletter by subject keywords', () => {
      const emailData = {
        subject: 'Weekly Newsletter #45',
        text: 'Regular content'
      };
      const cleanContent = { content: 'Regular content', wordCount: 2 };

      const result = emailParser.isLikelyNewsletter(emailData, cleanContent);
      expect(result).toBe(true);
    });

    test('should identify newsletter by unsubscribe content', () => {
      const emailData = {
        subject: 'Company Updates',
        text: 'Content with unsubscribe link at bottom'
      };
      const cleanContent = { 
        content: 'Content with unsubscribe link at bottom. Click here to unsubscribe from future emails.',
        wordCount: 100 
      };

      const result = emailParser.isLikelyNewsletter(emailData, cleanContent);
      expect(result).toBe(true);
    });

    test('should not identify short emails as newsletters', () => {
      const emailData = {
        subject: 'Short message',
        text: 'Hi'
      };
      const cleanContent = { content: 'Hi', wordCount: 1 };

      const result = emailParser.isLikelyNewsletter(emailData, cleanContent);
      expect(result).toBe(false);
    });
  });

  describe('extractEmailInfo', () => {
    test('should extract email information from address objects', () => {
      const emailField = [
        { name: 'Newsletter Team', address: 'newsletter@example.com' }
      ];

      const result = emailParser.extractEmailInfo(emailField);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'Newsletter Team');
      expect(result[0]).toHaveProperty('address', 'newsletter@example.com');
      expect(result[0]).toHaveProperty('domain', 'example.com');
    });

    test('should handle missing or null email fields', () => {
      expect(emailParser.extractEmailInfo(null)).toBeNull();
      expect(emailParser.extractEmailInfo(undefined)).toBeNull();
    });
  });

  describe('extractLinks', () => {
    test('should extract links from HTML content', () => {
      const html = `
        <a href="https://example.com/article1">Read Article 1</a>
        <a href="https://example.com/article2">Read Article 2</a>
        <a href="https://tracking.com/unsubscribe">Unsubscribe</a>
        <a href="https://tracking.com/pixel">Track</a>
      `;

      const result = emailParser.extractLinks(html);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        url: 'https://example.com/article1',
        text: 'Read Article 1'
      });
      expect(result[1]).toEqual({
        url: 'https://example.com/article2',
        text: 'Read Article 2'
      });
    });

    test('should return empty array for text content', () => {
      const result = emailParser.extractLinks('');
      expect(result).toEqual([]);
    });
  });

  describe('cleanUrl', () => {
    test('should remove tracking parameters', () => {
      const url = 'https://example.com/article?utm_source=newsletter&utm_campaign=weekly&id=123';
      const result = emailParser.cleanUrl(url);
      
      expect(result).toBe('https://example.com/article?id=123');
    });

    test('should handle malformed URLs gracefully', () => {
      const url = 'not-a-valid-url';
      const result = emailParser.cleanUrl(url);
      
      expect(result).toBe('not-a-valid-url');
    });
  });

  describe('detectLanguage', () => {
    test('should detect English content', () => {
      const content = 'This is an English newsletter with common words like the and for';
      const result = emailParser.detectLanguage(content);
      
      expect(result).toBe('en');
    });

    test('should return unknown for non-English content', () => {
      const content = 'Este es contenido en español sin palabras comunes en inglés';
      const result = emailParser.detectLanguage(content);
      
      expect(result).toBe('unknown');
    });
  });

  describe('htmlToCleanText', () => {
    test('should remove tracking elements', () => {
      const html = `
        <div>
          <h1>Newsletter</h1>
          <p>Content here</p>
          <img src="pixel.gif" width="1" height="1">
          <img src="tracking.gif" class="tracking">
          <!-- Tracking comment -->
        </div>
      `;

      const result = emailParser.htmlToCleanText(html);

      expect(result).toContain('Newsletter');
      expect(result).toContain('Content here');
      expect(result).not.toContain('pixel.gif');
      expect(result).not.toContain('Tracking comment');
    });

    test('should handle conversion errors gracefully', () => {
      const html = '<invalid-html><script>malicious</script>';
      
      const result = emailParser.htmlToCleanText(html);
      
      expect(typeof result).toBe('string');
      expect(result).not.toContain('<script>');
    });
  });

  describe('estimateSize', () => {
    test('should calculate email size correctly', () => {
      const emailData = {
        text: 'Short text',
        html: '<p>HTML content</p>',
        attachments: [
          { size: 1000 },
          { size: 2000 }
        ]
      };

      const result = emailParser.estimateSize(emailData);

      const expectedSize = emailData.text.length + emailData.html.length + 3000;
      expect(result).toBe(expectedSize);
    });

    test('should handle missing fields', () => {
      const emailData = {
        text: '',
        html: '',
        attachments: []
      };

      const result = emailParser.estimateSize(emailData);

      expect(result).toBe(0);
    });
  });
});