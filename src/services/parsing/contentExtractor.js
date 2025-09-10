const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const DOMPurify = require('dompurify');
const TurndownService = require('turndown');
const { URL } = require('url');

/**
 * Email Content Extractor Service
 * Extracts clean newsletter content from HTML emails using Mozilla Readability
 */
class ContentExtractor {
  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    // Configure turndown to handle newsletter-specific elements
    this.turndown.addRule('removeTracking', {
      filter: ['img[src*="track"]', 'img[width="1"]', 'img[height="1"]'],
      replacement: () => ''
    });
  }

  /**
   * Extract main content from HTML email
   * @param {string} htmlContent - Raw HTML content
   * @param {string} baseUrl - Base URL for resolving relative links
   * @returns {Object} Extracted content with metadata
   */
  async extractContent(htmlContent, baseUrl = '') {
    try {
      const startTime = Date.now();
      
      // Create DOM from HTML
      const dom = new JSDOM(htmlContent, { url: baseUrl });
      const document = dom.window.document;
      
      // Pre-process: Remove obvious non-content elements
      this.removeNonContentElements(document);
      
      // Use Readability to extract main content
      const reader = new Readability(document, {
        debug: false,
        maxElemsToDivide: 0, // Don't split elements for newsletters
        charThreshold: 25,   // Lower threshold for short newsletters
        classesToPreserve: ['newsletter-content', 'article-content']
      });
      
      const article = reader.parse();
      
      if (!article) {
        console.warn('Readability failed to parse content, falling back to body text');
        return this.fallbackExtraction(document, baseUrl);
      }
      
      // Post-process the extracted content
      const processedContent = await this.processExtractedContent(
        article.content, 
        baseUrl,
        document
      );
      
      const processingTime = Date.now() - startTime;
      
      return {
        title: article.title || this.extractTitle(document),
        content: processedContent.html,
        textContent: processedContent.text,
        excerpt: article.excerpt || this.generateExcerpt(processedContent.text),
        wordCount: this.countWords(processedContent.text),
        readingTime: Math.ceil(this.countWords(processedContent.text) / 200), // 200 WPM
        links: processedContent.links,
        images: processedContent.images,
        processingTime,
        extractionMethod: 'readability',
        success: true
      };
      
    } catch (error) {
      console.error('Content extraction failed:', error);
      return this.fallbackExtraction(htmlContent, baseUrl, error);
    }
  }

  /**
   * Remove elements that are clearly not main content
   * @param {Document} document - DOM document
   */
  removeNonContentElements(document) {
    // Remove tracking pixels and tiny images
    const trackingImages = document.querySelectorAll(
      'img[width="1"], img[height="1"], img[src*="track"], img[src*="pixel"], img[src*="beacon"]'
    );
    trackingImages.forEach(img => img.remove());
    
    // Remove unsubscribe sections
    const unsubscribeElements = document.querySelectorAll(
      '[class*="unsubscribe"], [class*="footer"], [id*="unsubscribe"], [id*="footer"]'
    );
    unsubscribeElements.forEach(el => {
      if (el.textContent.toLowerCase().includes('unsubscribe') ||
          el.textContent.toLowerCase().includes('manage preferences')) {
        el.remove();
      }
    });
    
    // Remove social media follow buttons
    const socialElements = document.querySelectorAll(
      '[class*="social"], [class*="follow"], [class*="share"]'
    );
    socialElements.forEach(el => {
      if (el.querySelectorAll('a').length > 2 && 
          (el.textContent.toLowerCase().includes('follow') ||
           el.textContent.toLowerCase().includes('social'))) {
        el.remove();
      }
    });
    
    // Remove advertisement sections
    const adElements = document.querySelectorAll(
      '[class*="ad"], [class*="sponsor"], [class*="promotion"]'
    );
    adElements.forEach(el => {
      if (el.textContent.toLowerCase().includes('advertisement') ||
          el.textContent.toLowerCase().includes('sponsored')) {
        el.remove();
      }
    });
  }

  /**
   * Process and clean extracted content
   * @param {string} htmlContent - Extracted HTML content
   * @param {string} baseUrl - Base URL for link resolution
   * @param {Document} originalDoc - Original document for context
   * @returns {Object} Processed content
   */
  async processExtractedContent(htmlContent, baseUrl, originalDoc) {
    // Create clean DOM for processing
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    
    // Normalize and validate links
    const links = this.normalizeLinks(document, baseUrl);
    
    // Process images
    const images = this.processImages(document, baseUrl);
    
    // Sanitize HTML to prevent XSS
    const window = dom.window;
    const purify = DOMPurify(window);
    
    // Configure DOMPurify for newsletter content
    const cleanHtml = purify.sanitize(document.body.innerHTML, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'div', 'span',
        'a', 'strong', 'b', 'em', 'i', 'u',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'src', 'width', 'height',
        'class', 'id', 'style', 'target'
      ],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'], // Allow target for external links
      FORBID_ATTR: ['onclick', 'onload', 'onerror']
    });
    
    // Convert to plain text for text content
    const textContent = this.turndown.turndown(cleanHtml);
    
    return {
      html: cleanHtml,
      text: textContent,
      links,
      images
    };
  }

  /**
   * Normalize and clean links
   * @param {Document} document - Document containing links
   * @param {string} baseUrl - Base URL for resolution
   * @returns {Array} Processed links
   */
  normalizeLinks(document, baseUrl) {
    const links = [];
    const linkElements = document.querySelectorAll('a[href]');
    
    linkElements.forEach(link => {
      try {
        let href = link.getAttribute('href');
        
        // Skip non-HTTP links
        if (href.startsWith('mailto:') || href.startsWith('tel:')) {
          return;
        }
        
        // Resolve relative URLs
        if (baseUrl && !href.startsWith('http')) {
          href = new URL(href, baseUrl).toString();
        }
        
        // Clean tracking parameters
        const url = new URL(href);
        const trackingParams = [
          'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
          'fb_source', 'gclid', 'mc_eid', 'mc_cid', '_ga'
        ];
        
        trackingParams.forEach(param => {
          url.searchParams.delete(param);
        });
        
        const cleanUrl = url.toString();
        
        // Update link in document
        link.setAttribute('href', cleanUrl);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        
        links.push({
          text: link.textContent.trim(),
          url: cleanUrl,
          originalUrl: href
        });
        
      } catch (error) {
        console.warn('Failed to process link:', href, error.message);
      }
    });
    
    return links;
  }

  /**
   * Process and validate images
   * @param {Document} document - Document containing images
   * @param {string} baseUrl - Base URL for resolution
   * @returns {Array} Processed images
   */
  processImages(document, baseUrl) {
    const images = [];
    const imageElements = document.querySelectorAll('img');
    
    imageElements.forEach(img => {
      try {
        let src = img.getAttribute('src');
        
        if (!src) return;
        
        // Resolve relative URLs
        if (baseUrl && !src.startsWith('http')) {
          src = new URL(src, baseUrl).toString();
          img.setAttribute('src', src);
        }
        
        // Skip tracking pixels
        const width = img.getAttribute('width');
        const height = img.getAttribute('height');
        if ((width === '1' || height === '1') || 
            src.includes('track') || src.includes('pixel')) {
          img.remove();
          return;
        }
        
        // Ensure alt text exists
        let alt = img.getAttribute('alt') || '';
        if (!alt) {
          alt = 'Newsletter image';
          img.setAttribute('alt', alt);
        }
        
        // Add loading attribute for performance
        img.setAttribute('loading', 'lazy');
        
        images.push({
          src,
          alt,
          width: width || 'auto',
          height: height || 'auto'
        });
        
      } catch (error) {
        console.warn('Failed to process image:', img.getAttribute('src'), error.message);
      }
    });
    
    return images;
  }

  /**
   * Extract title from document
   * @param {Document} document - DOM document
   * @returns {string} Extracted title
   */
  extractTitle(document) {
    // Try various selectors for title
    const titleSelectors = [
      'h1',
      '[class*="title"]',
      '[class*="headline"]',
      '[class*="subject"]',
      'title'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 5) {
        return element.textContent.trim();
      }
    }
    
    return 'Newsletter';
  }

  /**
   * Generate excerpt from text content
   * @param {string} textContent - Plain text content
   * @returns {string} Generated excerpt
   */
  generateExcerpt(textContent, maxLength = 200) {
    if (!textContent) return '';
    
    const cleaned = textContent
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
      
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    
    const truncated = cleaned.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    return lastSpaceIndex > 0 
      ? truncated.substring(0, lastSpaceIndex) + '...'
      : truncated + '...';
  }

  /**
   * Count words in text
   * @param {string} text - Text to count words in
   * @returns {number} Word count
   */
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Fallback extraction when Readability fails
   * @param {string|Document} content - HTML content or document
   * @param {string} baseUrl - Base URL
   * @param {Error} error - Original error
   * @returns {Object} Fallback extraction result
   */
  fallbackExtraction(content, baseUrl = '', error = null) {
    try {
      const document = typeof content === 'string' 
        ? new JSDOM(content).window.document 
        : content;
      
      // Simple extraction: get body text
      const bodyText = document.body ? document.body.textContent : '';
      const title = this.extractTitle(document);
      const excerpt = this.generateExcerpt(bodyText);
      
      return {
        title,
        content: document.body ? document.body.innerHTML : content,
        textContent: bodyText,
        excerpt,
        wordCount: this.countWords(bodyText),
        readingTime: Math.ceil(this.countWords(bodyText) / 200),
        links: [],
        images: [],
        processingTime: 0,
        extractionMethod: 'fallback',
        success: false,
        error: error ? error.message : 'Readability parsing failed'
      };
      
    } catch (fallbackError) {
      console.error('Fallback extraction also failed:', fallbackError);
      
      return {
        title: 'Newsletter',
        content: typeof content === 'string' ? content : '',
        textContent: typeof content === 'string' ? content.replace(/<[^>]*>/g, '') : '',
        excerpt: '',
        wordCount: 0,
        readingTime: 0,
        links: [],
        images: [],
        processingTime: 0,
        extractionMethod: 'raw',
        success: false,
        error: 'Complete extraction failure'
      };
    }
  }

  /**
   * Process plain text email and convert to HTML
   * @param {string} textContent - Plain text email content
   * @returns {Object} Processed content
   */
  processPlainTextEmail(textContent) {
    if (!textContent) {
      return this.fallbackExtraction('');
    }

    try {
      // Convert plain text to HTML
      let htmlContent = textContent
        // Convert URLs to links
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
        // Convert email addresses to mailto links
        .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>')
        // Convert line breaks to HTML
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br>');
      
      // Wrap in paragraphs
      htmlContent = `<p>${htmlContent}</p>`;
      
      // Extract title (first line or first sentence)
      const lines = textContent.split('\n').filter(line => line.trim());
      const title = lines[0] && lines[0].length < 100 
        ? lines[0].trim() 
        : textContent.substring(0, 50) + '...';
      
      const excerpt = this.generateExcerpt(textContent);
      const wordCount = this.countWords(textContent);
      
      return {
        title,
        content: htmlContent,
        textContent,
        excerpt,
        wordCount,
        readingTime: Math.ceil(wordCount / 200),
        links: this.extractLinksFromText(textContent),
        images: [],
        processingTime: 0,
        extractionMethod: 'plaintext',
        success: true
      };
      
    } catch (error) {
      console.error('Plain text processing failed:', error);
      return this.fallbackExtraction(textContent);
    }
  }

  /**
   * Extract links from plain text
   * @param {string} text - Plain text content
   * @returns {Array} Extracted links
   */
  extractLinksFromText(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links = [];
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
      links.push({
        text: match[1],
        url: match[1],
        originalUrl: match[1]
      });
    }
    
    return links;
  }
}

module.exports = ContentExtractor;