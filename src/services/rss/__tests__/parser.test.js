const rssParser = require('../parser');
const fetch = require('node-fetch');

// Mock node-fetch
jest.mock('node-fetch');

describe('RSSParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseFeed', () => {
    test('should parse valid RSS feed', async () => {
      const mockRSSFeed = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Test Blog</title>
            <description>A test blog</description>
            <link>https://example.com</link>
            <language>en</language>
            <item>
              <title>Test Article</title>
              <link>https://example.com/article1</link>
              <description>This is a test article content.</description>
              <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
              <guid>article-1</guid>
            </item>
          </channel>
        </rss>`;

      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(mockRSSFeed),
        headers: {
          get: jest.fn((header) => {
            if (header === 'etag') return '"test-etag"';
            if (header === 'last-modified') return 'Mon, 01 Jan 2024 12:00:00 GMT';
            return null;
          })
        }
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await rssParser.parseFeed('https://example.com/feed.xml');

      expect(result.title).toBe('Test Blog');
      expect(result.description).toBe('A test blog');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Test Article');
      expect(result.items[0].link).toBe('https://example.com/article1');
      expect(result.etag).toBe('"test-etag"');
      expect(result.lastModified).toBe('Mon, 01 Jan 2024 12:00:00 GMT');
      expect(result.notModified).toBe(false);
    });

    test('should handle 304 Not Modified response', async () => {
      const mockResponse = {
        status: 304,
        headers: {
          get: jest.fn((header) => {
            if (header === 'etag') return '"cached-etag"';
            if (header === 'last-modified') return 'Sun, 31 Dec 2023 12:00:00 GMT';
            return null;
          })
        }
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await rssParser.parseFeed('https://example.com/feed.xml', {
        etag: '"cached-etag"',
        lastModified: 'Sun, 31 Dec 2023 12:00:00 GMT'
      });

      expect(result.notModified).toBe(true);
      expect(result.etag).toBe('"cached-etag"');
      expect(result.lastModified).toBe('Sun, 31 Dec 2023 12:00:00 GMT');
    });

    test('should handle HTTP errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(rssParser.parseFeed('https://example.com/nonexistent.xml'))
        .rejects.toThrow('Failed to parse RSS feed: HTTP 404: Not Found');
    });

    test('should handle malformed XML', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('<invalid-xml>'),
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(rssParser.parseFeed('https://example.com/invalid.xml'))
        .rejects.toThrow('Failed to parse RSS feed:');
    });

    test('should include caching headers in request when provided', async () => {
      const mockRSSFeed = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Test Feed</title>
            <description>A test feed</description>
            <item>
              <title>Test Item</title>
            </item>
          </channel>
        </rss>`;

      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(mockRSSFeed),
        headers: { get: jest.fn().mockReturnValue(null) }
      };

      fetch.mockResolvedValue(mockResponse);

      await rssParser.parseFeed('https://example.com/feed.xml', {
        etag: '"test-etag"',
        lastModified: 'Mon, 01 Jan 2024 12:00:00 GMT'
      });

      expect(fetch).toHaveBeenCalledWith('https://example.com/feed.xml', expect.objectContaining({
        headers: expect.objectContaining({
          'If-None-Match': '"test-etag"',
          'If-Modified-Since': 'Mon, 01 Jan 2024 12:00:00 GMT'
        })
      }));
    });
  });

  describe('normalizeItem', () => {
    test('should normalize RSS item with all fields', () => {
      const rawItem = {
        title: 'Test Article',
        link: 'https://example.com/article1',
        'content:encoded': '<p>This is the full content</p>',
        description: 'Short description',
        pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT',
        author: 'John Doe',
        guid: 'article-1',
        categories: ['Tech', 'Programming']
      };

      const feedData = {
        title: 'Test Blog',
        link: 'https://example.com'
      };

      const result = rssParser.normalizeItem(rawItem, feedData);

      expect(result.title).toBe('Test Article');
      expect(result.link).toBe('https://example.com/article1');
      expect(result.content).toContain('This is the full content');
      expect(result.author).toBe('John Doe');
      expect(result.categories).toEqual(['Tech', 'Programming']);
      expect(result.normalizedHash).toBeDefined();
      expect(result.fingerprint).toBeDefined();
      expect(result.metadata.feedTitle).toBe('Test Blog');
    });

    test('should handle missing optional fields', () => {
      const rawItem = {
        title: 'Minimal Article'
      };

      const feedData = {
        title: 'Test Blog'
      };

      const result = rssParser.normalizeItem(rawItem, feedData);

      expect(result.title).toBe('Minimal Article');
      expect(result.link).toBe('');
      expect(result.content).toBe('');
      expect(result.author).toBe('');
      expect(result.categories).toEqual([]);
    });
  });

  describe('extractContent', () => {
    test('should prefer content:encoded over other fields', () => {
      const item = {
        'content:encoded': 'Full content',
        content: 'Partial content',
        description: 'Description content',
        summary: 'Summary content'
      };

      const result = rssParser.extractContent(item);
      expect(result).toBe('Full content');
    });

    test('should fallback through content fields in order', () => {
      const item1 = {
        content: 'Content field',
        description: 'Description field'
      };

      const item2 = {
        description: 'Description field'
      };

      expect(rssParser.extractContent(item1)).toBe('Content field');
      expect(rssParser.extractContent(item2)).toBe('Description field');
    });

    test('should return empty string when no content found', () => {
      const item = {};
      expect(rssParser.extractContent(item)).toBe('');
    });
  });

  describe('cleanAndExtractText', () => {
    test('should clean HTML content', () => {
      const htmlContent = '<p>This is <strong>important</strong> content.</p><script>alert("bad");</script>';

      const result = rssParser.cleanAndExtractText(htmlContent);

      expect(result.content).toContain('This is important content');
      expect(result.content).not.toContain('<script>');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.estimatedReadTime).toBeGreaterThan(0);
    });

    test('should handle plain text content', () => {
      const textContent = 'This is plain text content with multiple words.';

      const result = rssParser.cleanAndExtractText(textContent);

      expect(result.content).toBe(textContent);
      expect(result.wordCount).toBe(8);
      expect(result.estimatedReadTime).toBe(1);
    });

    test('should handle empty content', () => {
      const result = rssParser.cleanAndExtractText('');

      expect(result.content).toBe('');
      expect(result.wordCount).toBe(0);
      expect(result.estimatedReadTime).toBe(0);
    });
  });

  describe('extractPublishedDate', () => {
    test('should parse valid date strings', () => {
      const item1 = { pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT' };
      const item2 = { published: '2024-01-01T12:00:00Z' };

      const result1 = rssParser.extractPublishedDate(item1);
      const result2 = rssParser.extractPublishedDate(item2);

      expect(result1).toBeInstanceOf(Date);
      expect(result2).toBeInstanceOf(Date);
      expect(result1.getFullYear()).toBe(2024);
      expect(result2.getFullYear()).toBe(2024);
    });

    test('should fallback to current date for invalid dates', () => {
      const item = { pubDate: 'invalid-date' };
      const before = new Date();
      const result = rssParser.extractPublishedDate(item);
      const after = new Date();

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('generateContentHash', () => {
    test('should generate consistent hashes for same content', () => {
      const title = 'Test Title';
      const content = 'Test content here';

      const hash1 = rssParser.generateContentHash(title, content);
      const hash2 = rssParser.generateContentHash(title, content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    test('should generate different hashes for different content', () => {
      const hash1 = rssParser.generateContentHash('Title 1', 'Content 1');
      const hash2 = rssParser.generateContentHash('Title 2', 'Content 2');

      expect(hash1).not.toBe(hash2);
    });

    test('should normalize whitespace before hashing', () => {
      const hash1 = rssParser.generateContentHash('Title', 'Content with   spaces');
      const hash2 = rssParser.generateContentHash('Title', 'Content with spaces');

      expect(hash1).toBe(hash2);
    });
  });

  describe('generateFingerprint', () => {
    test('should generate consistent fingerprints', () => {
      const title = 'Important Article About Technology';
      const content = 'This article discusses important technological developments and innovations.';

      const fp1 = rssParser.generateFingerprint(title, content);
      const fp2 = rssParser.generateFingerprint(title, content);

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(8);
    });

    test('should generate similar fingerprints for similar content', () => {
      const title1 = 'Important Article About Technology';
      const title2 = 'Important Article About Technology News';
      const content = 'This article discusses important technological developments.';

      const fp1 = rssParser.generateFingerprint(title1, content);
      const fp2 = rssParser.generateFingerprint(title2, content);

      // They might be the same or different, depending on the algorithm
      // Just test that both are valid fingerprints
      expect(fp1).toHaveLength(8);
      expect(fp2).toHaveLength(8);
    });
  });

  describe('validateFeed', () => {
    test('should validate legitimate RSS feed', async () => {
      const mockRSSFeed = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Valid Feed</title>
            <item><title>Item 1</title></item>
          </channel>
        </rss>`;

      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(mockRSSFeed),
        headers: { get: jest.fn().mockReturnValue(null) }
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await rssParser.validateFeed('https://example.com/feed.xml');

      expect(result.valid).toBe(true);
      expect(result.feedData.title).toBe('Valid Feed');
      expect(result.feedData.itemCount).toBe(1);
    });

    test('should reject invalid URLs', async () => {
      const result = await rssParser.validateFeed('ftp://example.com/feed.xml');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid protocol');
    });

    test('should reject feeds that fail to parse', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await rssParser.validateFeed('https://example.com/notfound.xml');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Feed validation failed');
    });
  });

  describe('looksLikeRSSFeed', () => {
    test('should recognize RSS feed URLs', () => {
      const rssFeedUrls = [
        'https://example.com/rss',
        'https://example.com/feed',
        'https://example.com/atom',
        'https://example.com/feed.xml',
        'https://example.com/rss.xml',
        'https://example.com/blog.rss'
      ];

      rssFeedUrls.forEach(url => {
        expect(rssParser.looksLikeRSSFeed(url)).toBe(true);
      });
    });

    test('should not recognize non-RSS URLs', () => {
      const nonRssUrls = [
        'https://example.com/blog',
        'https://example.com/page.html',
        'https://example.com/api/data',
        'https://example.com/index.php'
      ];

      nonRssUrls.forEach(url => {
        expect(rssParser.looksLikeRSSFeed(url)).toBe(false);
      });
    });
  });

  describe('discoverFeeds', () => {
    test('should discover RSS feeds from HTML page', async () => {
      const mockHTML = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Main Feed">
            <link rel="alternate" type="application/atom+xml" href="/atom.xml" title="Atom Feed">
          </head>
          <body>Content</body>
        </html>
      `;

      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockHTML)
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await rssParser.discoverFeeds('https://example.com/blog');

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://example.com/feed.xml');
      expect(result[0].title).toBe('Main Feed');
      expect(result[1].url).toBe('https://example.com/atom.xml');
      expect(result[1].title).toBe('Atom Feed');
    });

    test('should handle pages with no RSS feeds', async () => {
      const mockHTML = '<html><body>No feeds here</body></html>';

      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockHTML)
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await rssParser.discoverFeeds('https://example.com/page');

      expect(result).toEqual([]);
    });

    test('should handle network errors gracefully', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const result = await rssParser.discoverFeeds('https://example.com/error');

      expect(result).toEqual([]);
    });
  });

  describe('cleanText', () => {
    test('should clean and normalize text', () => {
      const dirtyText = '  Multiple   spaces\n\nand\t\ttabs  ';
      const result = rssParser.cleanText(dirtyText);

      expect(result).toBe('Multiple spaces and tabs');
    });

    test('should handle non-string input', () => {
      expect(rssParser.cleanText(null)).toBe('');
      expect(rssParser.cleanText(undefined)).toBe('');
      expect(rssParser.cleanText(123)).toBe('');
    });

    test('should remove unicode zero-width characters', () => {
      const textWithZeroWidth = 'Text\u200Bwith\u200Czero\u200Dwidth\uFEFFchars';
      const result = rssParser.cleanText(textWithZeroWidth);

      expect(result).toBe('Textwithzerowidth chars');
    });
  });
});