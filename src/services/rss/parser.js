const Parser = require('rss-parser');
const fetch = require('node-fetch');
const { convert } = require('html-to-text');
const crypto = require('crypto');

class RSSParser {
  constructor() {
    this.parser = new Parser({
      customFields: {
        feed: ['lastBuildDate', 'language', 'generator'],
        item: ['content:encoded', 'summary', 'description', 'content', 'author', 'creator']
      },
      timeout: 10000, // 10 second timeout
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Newsletter-Scraper/1.0.0 (RSS Reader)'
      }
    });

    this.htmlToTextOptions = {
      wordwrap: 130,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'figure', format: 'skip' },
        { selector: '.social-share', format: 'skip' },
        { selector: '.footer', format: 'skip' }
      ]
    };
  }

  /**
   * Parse RSS feed from URL with caching support
   * @param {string} feedUrl - RSS feed URL
   * @param {Object} options - Parsing options
   * @returns {Object} Parsed feed data
   */
  async parseFeed(feedUrl, options = {}) {
    try {
      console.log(`Parsing RSS feed: ${feedUrl}`);

      // Prepare headers for conditional requests
      const headers = {
        'User-Agent': 'Newsletter-Scraper/1.0.0 (RSS Reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
      };

      // Add caching headers if provided
      if (options.etag) {
        headers['If-None-Match'] = options.etag;
      }
      if (options.lastModified) {
        headers['If-Modified-Since'] = options.lastModified;
      }

      // Fetch the feed
      const response = await fetch(feedUrl, {
        headers,
        timeout: 10000,
        redirect: 'follow'
      });

      // Handle 304 Not Modified
      if (response.status === 304) {
        return {
          notModified: true,
          etag: response.headers.get('etag'),
          lastModified: response.headers.get('last-modified')
        };
      }

      // Handle other error status codes
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get response text and parse
      const feedXml = await response.text();
      const parsedFeed = await this.parser.parseString(feedXml);

      // Extract caching headers
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');

      // Process and normalize the feed
      const normalizedFeed = this.normalizeFeed(parsedFeed, feedUrl);

      return {
        ...normalizedFeed,
        etag,
        lastModified,
        notModified: false,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`RSS parsing error for ${feedUrl}:`, error);
      throw new Error(`Failed to parse RSS feed: ${error.message}`);
    }
  }

  /**
   * Normalize parsed feed data
   * @param {Object} parsedFeed - Raw parsed feed
   * @param {string} feedUrl - Original feed URL
   * @returns {Object} Normalized feed data
   */
  normalizeFeed(parsedFeed, feedUrl) {
    const feed = {
      title: this.cleanText(parsedFeed.title) || 'Untitled Feed',
      description: this.cleanText(parsedFeed.description) || '',
      link: parsedFeed.link || feedUrl,
      language: parsedFeed.language || 'en',
      generator: parsedFeed.generator || '',
      lastBuildDate: parsedFeed.lastBuildDate ? new Date(parsedFeed.lastBuildDate) : null,
      items: []
    };

    // Process feed items
    if (parsedFeed.items && Array.isArray(parsedFeed.items)) {
      feed.items = parsedFeed.items.map(item => this.normalizeItem(item, feed)).filter(Boolean);
    }

    return feed;
  }

  /**
   * Normalize individual RSS item
   * @param {Object} rawItem - Raw RSS item
   * @param {Object} feedData - Parent feed data
   * @returns {Object} Normalized item
   */
  normalizeItem(rawItem, feedData) {
    try {
      // Extract content from various possible fields
      const content = this.extractContent(rawItem);
      const cleanContent = this.cleanAndExtractText(content);

      // Extract publication date
      const publishedAt = this.extractPublishedDate(rawItem);

      // Generate unique ID for the item
      const guid = rawItem.guid || rawItem.id || rawItem.link || '';
      const itemId = this.generateItemId(rawItem, feedData);

      const item = {
        id: itemId,
        guid: guid,
        title: this.cleanText(rawItem.title) || 'Untitled',
        link: rawItem.link || '',
        content: cleanContent.content,
        rawContent: content,
        summary: this.extractSummary(rawItem, cleanContent.content),
        author: this.extractAuthor(rawItem),
        publishedAt: publishedAt,
        categories: this.extractCategories(rawItem),
        metadata: {
          feedTitle: feedData.title,
          feedLink: feedData.link,
          wordCount: cleanContent.wordCount,
          estimatedReadTime: cleanContent.estimatedReadTime,
          hasImages: content.includes('<img'),
          contentType: content.includes('<') ? 'html' : 'text'
        }
      };

      // Generate content hash for deduplication
      item.normalizedHash = this.generateContentHash(item.title, item.content);
      item.fingerprint = this.generateFingerprint(item.title, item.content);

      return item;
    } catch (error) {
      console.error('Error normalizing RSS item:', error);
      return null;
    }
  }

  /**
   * Extract content from various RSS content fields
   * @param {Object} item - RSS item
   * @returns {string} Extracted content
   */
  extractContent(item) {
    // Try different content fields in order of preference
    const contentFields = [
      'content:encoded',
      'content',
      'description',
      'summary'
    ];

    for (const field of contentFields) {
      if (item[field] && typeof item[field] === 'string' && item[field].trim().length > 0) {
        return item[field].trim();
      }
    }

    return '';
  }

  /**
   * Clean and extract text from HTML content
   * @param {string} htmlContent - HTML content
   * @returns {Object} Clean text and metadata
   */
  cleanAndExtractText(htmlContent) {
    if (!htmlContent) {
      return { content: '', wordCount: 0, estimatedReadTime: 0 };
    }

    // If content appears to be plain text, return as-is
    if (!htmlContent.includes('<')) {
      const words = htmlContent.split(/\s+/).length;
      return {
        content: htmlContent.trim(),
        wordCount: words,
        estimatedReadTime: Math.ceil(words / 200)
      };
    }

    try {
      // Convert HTML to clean text
      const cleanText = convert(htmlContent, this.htmlToTextOptions);
      const words = cleanText.split(/\s+/).filter(w => w.length > 0).length;

      return {
        content: cleanText.trim(),
        wordCount: words,
        estimatedReadTime: Math.ceil(words / 200)
      };
    } catch (error) {
      console.warn('HTML to text conversion failed:', error.message);
      // Fallback: strip HTML tags manually
      const stripHtml = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = stripHtml.split(/\s+/).length;
      
      return {
        content: stripHtml,
        wordCount: words,
        estimatedReadTime: Math.ceil(words / 200)
      };
    }
  }

  /**
   * Extract summary from item
   * @param {Object} item - RSS item
   * @param {string} content - Full content
   * @returns {string} Summary text
   */
  extractSummary(item, content) {
    // Use explicit summary if available
    if (item.summary && item.summary !== item.description) {
      return this.cleanText(item.summary);
    }

    // Use description if different from content
    if (item.description && item.description !== content) {
      return this.cleanText(item.description);
    }

    // Generate summary from content (first 200 words)
    if (content) {
      const words = content.split(/\s+/).slice(0, 200);
      return words.join(' ') + (words.length >= 200 ? '...' : '');
    }

    return '';
  }

  /**
   * Extract author information
   * @param {Object} item - RSS item
   * @returns {string} Author name
   */
  extractAuthor(item) {
    return this.cleanText(item.creator || item.author || '');
  }

  /**
   * Extract categories/tags
   * @param {Object} item - RSS item
   * @returns {Array} Categories array
   */
  extractCategories(item) {
    if (!item.categories) return [];
    
    if (Array.isArray(item.categories)) {
      return item.categories.map(cat => this.cleanText(cat)).filter(Boolean);
    }
    
    if (typeof item.categories === 'string') {
      return [this.cleanText(item.categories)].filter(Boolean);
    }
    
    return [];
  }

  /**
   * Extract publication date
   * @param {Object} item - RSS item
   * @returns {Date} Publication date
   */
  extractPublishedDate(item) {
    const dateFields = ['pubDate', 'published', 'date', 'updated'];
    
    for (const field of dateFields) {
      if (item[field]) {
        const date = new Date(item[field]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    // Fallback to current date
    return new Date();
  }

  /**
   * Generate unique item ID
   * @param {Object} item - RSS item
   * @param {Object} feedData - Feed data
   * @returns {string} Unique item ID
   */
  generateItemId(item, feedData) {
    // Use GUID if available and looks like a proper ID
    if (item.guid && (item.guid.includes('://') || item.guid.length > 20)) {
      return crypto.createHash('md5').update(item.guid).digest('hex');
    }

    // Use link if available
    if (item.link) {
      return crypto.createHash('md5').update(item.link).digest('hex');
    }

    // Generate from title + feed + date
    const title = item.title || '';
    const feedTitle = feedData.title || '';
    const date = item.pubDate || item.published || '';
    const combined = `${feedTitle}:${title}:${date}`;
    
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  /**
   * Generate content hash for deduplication
   * @param {string} title - Item title
   * @param {string} content - Item content
   * @returns {string} SHA-256 hash
   */
  generateContentHash(title, content) {
    const normalizedTitle = (title || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedContent = (content || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const combined = `${normalizedTitle}|${normalizedContent}`;
    
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Generate fingerprint for near-duplicate detection
   * @param {string} title - Item title
   * @param {string} content - Item content
   * @returns {string} MD5 hash of key features
   */
  generateFingerprint(title, content) {
    const titleWords = (title || '').toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const contentWords = (content || '').toLowerCase().split(/\W+/).filter(w => w.length > 4);
    
    const features = [
      ...titleWords.slice(0, 5),
      ...contentWords.slice(0, 10),
      (content || '').substring(0, 50).toLowerCase().replace(/\W/g, '')
    ].join('|');
    
    return crypto.createHash('md5').update(features).digest('hex').substring(0, 8);
  }

  /**
   * Clean text content
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  /**
   * Validate RSS feed URL and check if it's parseable
   * @param {string} feedUrl - RSS feed URL to validate
   * @returns {Object} Validation result
   */
  async validateFeed(feedUrl) {
    try {
      // Basic URL validation
      const url = new URL(feedUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          valid: false,
          error: 'Invalid protocol. Only HTTP and HTTPS are supported.'
        };
      }

      // Try to fetch and parse the feed
      const result = await this.parseFeed(feedUrl);
      
      if (result.notModified) {
        return {
          valid: false,
          error: 'Unable to validate feed due to 304 response'
        };
      }

      // Check if we got a valid feed structure
      if (!result.title && (!result.items || result.items.length === 0)) {
        return {
          valid: false,
          error: 'Feed appears to be empty or invalid'
        };
      }

      return {
        valid: true,
        feedData: {
          title: result.title,
          description: result.description,
          link: result.link,
          itemCount: result.items.length,
          language: result.language
        }
      };

    } catch (error) {
      return {
        valid: false,
        error: `Feed validation failed: ${error.message}`
      };
    }
  }

  /**
   * Check if URL looks like an RSS feed
   * @param {string} url - URL to check
   * @returns {boolean} Whether URL looks like RSS
   */
  looksLikeRSSFeed(url) {
    const rssPatterns = [
      /\/rss\/?$/i,
      /\/feed\/?$/i,
      /\/atom\/?$/i,
      /\.rss$/i,
      /\.xml$/i,
      /\/rss\.xml$/i,
      /\/feed\.xml$/i,
      /\/atom\.xml$/i
    ];

    return rssPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Discover RSS feeds from a webpage URL
   * @param {string} pageUrl - Webpage URL
   * @returns {Array} Array of discovered feed URLs
   */
  async discoverFeeds(pageUrl) {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Newsletter-Scraper/1.0.0 (RSS Reader)'
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const feeds = [];

      // Look for RSS/Atom links in HTML
      const linkRegex = /<link[^>]+type=['"]application\/(rss|atom)\+xml['"][^>]*>/gi;
      const hrefRegex = /href=['"]([^'"]+)['"]/i;
      const titleRegex = /title=['"]([^'"]+)['"]/i;

      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const hrefMatch = match[0].match(hrefRegex);
        const titleMatch = match[0].match(titleRegex);
        
        if (hrefMatch) {
          let feedUrl = hrefMatch[1];
          
          // Convert relative URLs to absolute
          if (feedUrl.startsWith('/')) {
            const baseUrl = new URL(pageUrl);
            feedUrl = `${baseUrl.protocol}//${baseUrl.host}${feedUrl}`;
          } else if (!feedUrl.startsWith('http')) {
            feedUrl = new URL(feedUrl, pageUrl).toString();
          }

          feeds.push({
            url: feedUrl,
            title: titleMatch ? titleMatch[1] : 'RSS Feed'
          });
        }
      }

      // Try common RSS endpoints if none found
      if (feeds.length === 0) {
        const commonEndpoints = ['/rss', '/feed', '/atom.xml', '/rss.xml', '/feed.xml'];
        const baseUrl = new URL(pageUrl);
        
        for (const endpoint of commonEndpoints) {
          const feedUrl = `${baseUrl.protocol}//${baseUrl.host}${endpoint}`;
          try {
            const validation = await this.validateFeed(feedUrl);
            if (validation.valid) {
              feeds.push({
                url: feedUrl,
                title: validation.feedData.title || 'RSS Feed'
              });
            }
          } catch (error) {
            // Ignore errors for discovery
          }
        }
      }

      return feeds;
    } catch (error) {
      console.error('Feed discovery error:', error);
      return [];
    }
  }
}

module.exports = new RSSParser();