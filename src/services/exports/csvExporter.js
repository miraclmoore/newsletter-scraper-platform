const { Parser } = require('json2csv');
const fs = require('fs').promises;
const path = require('path');

/**
 * CSV Export Service
 * Converts newsletter items to structured CSV format
 */
class CSVExporter {
  constructor() {
    // Define standard CSV fields
    this.defaultFields = [
      { label: 'Title', value: 'title' },
      { label: 'Source', value: 'source.name' },
      { label: 'Source Type', value: 'source.type' },
      { label: 'Published Date', value: 'publishedAt' },
      { label: 'Created Date', value: 'createdAt' },
      { label: 'URL', value: 'url' },
      { label: 'Content', value: 'textContent' },
      { label: 'Excerpt', value: 'excerpt' },
      { label: 'Word Count', value: 'metadata.processing.wordCount' },
      { label: 'Reading Time (min)', value: 'metadata.processing.estimatedReadTime' },
      { label: 'Sender Name', value: 'metadata.sender.name' },
      { label: 'Sender Email', value: 'metadata.sender.address' },
      { label: 'Sender Domain', value: 'metadata.sender.domain' },
      { label: 'Has Attachments', value: 'metadata.processing.hasAttachments' },
      { label: 'Link Count', value: row => (row.metadata?.links || []).length },
      { label: 'Top Links', value: row => this.formatLinks(row.metadata?.links || []) }
    ];
  }

  /**
   * Export items to CSV format
   * @param {Array} items - Newsletter items
   * @param {Object} options - Export options
   * @returns {string} CSV content
   */
  exportItems(items, options = {}) {
    try {
      const {
        fields = this.defaultFields,
        includeContent = true,
        dateFormat = 'iso'
      } = options;

      // Process items for CSV export
      const processedItems = items.map(item => this.processItem(item, { includeContent, dateFormat }));

      // Filter fields if content should be excluded
      const csvFields = includeContent 
        ? fields 
        : fields.filter(field => !['textContent', 'content'].includes(field.value));

      const parser = new Parser({
        fields: csvFields,
        quote: '"',
        escapedQuote: '""',
        delimiter: ',',
        eol: '\n',
        excelStrings: false,
        header: true
      });

      return parser.parse(processedItems);

    } catch (error) {
      console.error('CSV export failed:', error);
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  /**
   * Process individual item for CSV export
   * @param {Object} item - Newsletter item
   * @param {Object} options - Processing options
   * @returns {Object} Processed item
   */
  processItem(item, options = {}) {
    const { includeContent = true, dateFormat = 'iso' } = options;

    const processed = {
      ...item,
      // Format dates
      publishedAt: this.formatDate(item.publishedAt, dateFormat),
      createdAt: this.formatDate(item.createdAt, dateFormat),
      updatedAt: this.formatDate(item.updatedAt, dateFormat),
      
      // Extract text content from HTML if needed
      textContent: includeContent ? this.extractTextContent(item) : '',
      
      // Generate excerpt if not present
      excerpt: item.excerpt || this.generateExcerpt(item.content || item.textContent || ''),
      
      // Ensure nested objects exist
      source: item.source || { name: 'Unknown', type: 'unknown' },
      metadata: {
        ...item.metadata,
        processing: item.metadata?.processing || {},
        sender: item.metadata?.sender || {},
        links: item.metadata?.links || []
      }
    };

    // Clean up content for CSV (remove newlines, quotes, etc.)
    if (processed.textContent) {
      processed.textContent = this.sanitizeForCSV(processed.textContent);
    }
    
    if (processed.title) {
      processed.title = this.sanitizeForCSV(processed.title);
    }

    return processed;
  }

  /**
   * Extract plain text content from HTML
   * @param {Object} item - Newsletter item
   * @returns {string} Plain text content
   */
  extractTextContent(item) {
    if (item.textContent) {
      return item.textContent;
    }
    
    if (item.content) {
      // Simple HTML strip - for more complex cases, use a proper HTML parser
      return item.content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    return '';
  }

  /**
   * Generate excerpt from content
   * @param {string} content - Full content
   * @param {number} maxLength - Maximum excerpt length
   * @returns {string} Generated excerpt
   */
  generateExcerpt(content, maxLength = 200) {
    if (!content) return '';
    
    const text = typeof content === 'string' ? content : String(content);
    const cleaned = text.replace(/\s+/g, ' ').trim();
    
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    
    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > 0 
      ? truncated.substring(0, lastSpace) + '...'
      : truncated + '...';
  }

  /**
   * Format date for CSV export
   * @param {string|Date} date - Date to format
   * @param {string} format - Format type
   * @returns {string} Formatted date
   */
  formatDate(date, format = 'iso') {
    if (!date) return '';
    
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    switch (format) {
      case 'iso':
        return dateObj.toISOString();
      case 'date':
        return dateObj.toISOString().split('T')[0];
      case 'readable':
        return dateObj.toLocaleDateString('en-US');
      case 'timestamp':
        return dateObj.getTime().toString();
      default:
        return dateObj.toISOString();
    }
  }

  /**
   * Format links for CSV display
   * @param {Array} links - Array of link objects
   * @returns {string} Formatted links string
   */
  formatLinks(links) {
    if (!Array.isArray(links) || links.length === 0) {
      return '';
    }
    
    return links
      .slice(0, 5) // Limit to top 5 links
      .map(link => link.url || link.text || '')
      .filter(Boolean)
      .join('; ');
  }

  /**
   * Sanitize text for CSV format
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeForCSV(text) {
    if (!text) return '';
    
    return String(text)
      // Replace newlines with spaces
      .replace(/\r?\n|\r/g, ' ')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      // Handle quotes (will be escaped by CSV parser)
      .trim();
  }

  /**
   * Create summary CSV with aggregated data
   * @param {Array} items - Newsletter items
   * @returns {string} Summary CSV content
   */
  createSummaryCSV(items) {
    try {
      // Aggregate statistics by source
      const summaryData = this.aggregateBySource(items);
      
      const summaryFields = [
        { label: 'Source', value: 'source' },
        { label: 'Source Type', value: 'sourceType' },
        { label: 'Newsletter Count', value: 'count' },
        { label: 'Total Words', value: 'totalWords' },
        { label: 'Average Words', value: 'avgWords' },
        { label: 'Total Reading Time (min)', value: 'totalReadingTime' },
        { label: 'Date Range Start', value: 'dateRangeStart' },
        { label: 'Date Range End', value: 'dateRangeEnd' },
        { label: 'Most Recent', value: 'mostRecent' },
        { label: 'Unique Domains', value: 'uniqueDomains' }
      ];

      const parser = new Parser({
        fields: summaryFields,
        quote: '"',
        delimiter: ',',
        header: true
      });

      return parser.parse(summaryData);

    } catch (error) {
      console.error('Summary CSV creation failed:', error);
      throw new Error(`Summary CSV creation failed: ${error.message}`);
    }
  }

  /**
   * Aggregate statistics by source
   * @param {Array} items - Newsletter items
   * @returns {Array} Aggregated data
   */
  aggregateBySource(items) {
    const sourceStats = {};
    
    items.forEach(item => {
      const sourceName = item.source?.name || 'Unknown';
      const sourceType = item.source?.type || 'unknown';
      
      if (!sourceStats[sourceName]) {
        sourceStats[sourceName] = {
          source: sourceName,
          sourceType,
          count: 0,
          totalWords: 0,
          totalReadingTime: 0,
          dates: [],
          domains: new Set()
        };
      }
      
      const stats = sourceStats[sourceName];
      stats.count++;
      stats.totalWords += item.metadata?.processing?.wordCount || 0;
      stats.totalReadingTime += item.metadata?.processing?.estimatedReadTime || 0;
      stats.dates.push(new Date(item.publishedAt || item.createdAt));
      
      if (item.metadata?.sender?.domain) {
        stats.domains.add(item.metadata.sender.domain);
      }
    });
    
    // Process final statistics
    return Object.values(sourceStats).map(stats => {
      const sortedDates = stats.dates.sort((a, b) => a - b);
      
      return {
        source: stats.source,
        sourceType: stats.sourceType,
        count: stats.count,
        totalWords: stats.totalWords,
        avgWords: Math.round(stats.totalWords / stats.count) || 0,
        totalReadingTime: stats.totalReadingTime,
        dateRangeStart: sortedDates[0].toISOString().split('T')[0],
        dateRangeEnd: sortedDates[sortedDates.length - 1].toISOString().split('T')[0],
        mostRecent: sortedDates[sortedDates.length - 1].toISOString().split('T')[0],
        uniqueDomains: stats.domains.size
      };
    });
  }

  /**
   * Save CSV to file
   * @param {string} csvContent - CSV content
   * @param {string} filename - Output filename
   * @param {string} outputDir - Output directory
   * @returns {string} File path
   */
  async saveToFile(csvContent, filename, outputDir = './exports') {
    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });
      
      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `newsletter-export-${timestamp}.csv`;
      }
      
      // Ensure .csv extension
      if (!filename.endsWith('.csv')) {
        filename += '.csv';
      }
      
      const filePath = path.join(outputDir, filename);
      
      // Write file with UTF-8 BOM for Excel compatibility
      const bom = '\uFEFF';
      await fs.writeFile(filePath, bom + csvContent, 'utf8');
      
      return filePath;
    } catch (error) {
      console.error('Failed to save CSV file:', error);
      throw new Error(`Failed to save CSV file: ${error.message}`);
    }
  }

  /**
   * Generate download-ready CSV buffer
   * @param {Array} items - Newsletter items
   * @param {Object} options - Export options
   * @returns {Object} Buffer and metadata
   */
  async generateDownload(items, options = {}) {
    const { includeSummary = false } = options;
    
    let csvContent = this.exportItems(items, options);
    
    // Add summary sheet if requested
    if (includeSummary) {
      const summaryCSV = this.createSummaryCSV(items);
      csvContent += '\n\n' + '='.repeat(50) + '\n';
      csvContent += 'SUMMARY BY SOURCE\n';
      csvContent += '='.repeat(50) + '\n\n';
      csvContent += summaryCSV;
    }
    
    // Add UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF';
    const buffer = Buffer.from(bom + csvContent, 'utf8');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = options.filename || `newsletter-export-${timestamp}.csv`;
    
    return {
      buffer,
      filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
      contentType: 'text/csv',
      size: buffer.length
    };
  }

  /**
   * Create custom field configuration
   * @param {Array} customFields - Custom field definitions
   * @returns {Array} Processed field configuration
   */
  createCustomFields(customFields) {
    return customFields.map(field => {
      if (typeof field === 'string') {
        return { label: field, value: field };
      }
      return field;
    });
  }

  /**
   * Validate items for export
   * @param {Array} items - Newsletter items
   * @returns {Object} Validation result
   */
  validateItems(items) {
    if (!Array.isArray(items)) {
      return { valid: false, error: 'Items must be an array' };
    }
    
    if (items.length === 0) {
      return { valid: false, error: 'No items to export' };
    }
    
    if (items.length > 10000) {
      return { valid: false, error: 'Too many items for export (max 10,000)' };
    }
    
    return { valid: true };
  }
}

module.exports = CSVExporter;