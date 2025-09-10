const TurndownService = require('turndown');
const fs = require('fs').promises;
const path = require('path');

/**
 * Markdown Export Service
 * Converts newsletter items to structured Markdown format
 */
class MarkdownExporter {
  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full'
    });

    // Custom rules for newsletter content
    this.turndown.addRule('preserveLineBreaks', {
      filter: ['br'],
      replacement: () => '\n\n'
    });

    this.turndown.addRule('cleanEmptyParagraphs', {
      filter: (node) => node.nodeName === 'P' && node.textContent.trim() === '',
      replacement: () => ''
    });
  }

  /**
   * Export single newsletter item to Markdown
   * @param {Object} item - Newsletter item
   * @returns {string} Markdown content
   */
  exportItem(item) {
    const metadata = this.generateFrontMatter(item);
    const content = this.convertToMarkdown(item.content);
    
    return `${metadata}\n\n${content}`;
  }

  /**
   * Export multiple items to Markdown
   * @param {Array} items - Array of newsletter items
   * @param {Object} options - Export options
   * @returns {string} Combined Markdown content
   */
  exportItems(items, options = {}) {
    const { groupBySource = false, includeIndex = true } = options;
    
    let markdown = '';
    
    // Add document header
    if (includeIndex) {
      markdown += this.generateIndex(items);
      markdown += '\n\n---\n\n';
    }
    
    if (groupBySource) {
      markdown += this.exportItemsGroupedBySource(items);
    } else {
      markdown += this.exportItemsChronologically(items);
    }
    
    return markdown;
  }

  /**
   * Generate YAML front matter for item
   * @param {Object} item - Newsletter item
   * @returns {string} YAML front matter
   */
  generateFrontMatter(item) {
    const source = item.source || {};
    const publishDate = new Date(item.publishedAt || item.createdAt);
    
    const frontMatter = {
      title: item.title || 'Untitled Newsletter',
      source: source.name || 'Unknown Source',
      sourceType: source.type || 'unknown',
      publishedDate: publishDate.toISOString().split('T')[0],
      url: item.url || null,
      wordCount: item.metadata?.processing?.wordCount || 0,
      readingTime: item.metadata?.processing?.estimatedReadTime || 0,
      tags: this.extractTags(item)
    };

    // Add custom metadata if available
    if (item.metadata?.sender) {
      frontMatter.sender = {
        name: item.metadata.sender.name,
        email: item.metadata.sender.address,
        domain: item.metadata.sender.domain
      };
    }

    const yamlContent = Object.entries(frontMatter)
      .map(([key, value]) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'object') {
          return `${key}:\n${Object.entries(value)
            .map(([k, v]) => `  ${k}: "${v}"`)
            .join('\n')}`;
        }
        return `${key}: "${value}"`;
      })
      .filter(line => line !== null)
      .join('\n');

    return `---\n${yamlContent}\n---`;
  }

  /**
   * Convert HTML content to Markdown
   * @param {string} htmlContent - HTML content
   * @returns {string} Markdown content
   */
  convertToMarkdown(htmlContent) {
    if (!htmlContent) return '';
    
    try {
      let markdown = this.turndown.turndown(htmlContent);
      
      // Clean up extra whitespace
      markdown = markdown
        .replace(/\n\n\n+/g, '\n\n')
        .replace(/^\s+|\s+$/g, '')
        .trim();
      
      return markdown;
    } catch (error) {
      console.error('Markdown conversion failed:', error);
      return htmlContent.replace(/<[^>]*>/g, ''); // Strip HTML as fallback
    }
  }

  /**
   * Generate table of contents/index
   * @param {Array} items - Newsletter items
   * @returns {string} Index markdown
   */
  generateIndex(items) {
    const totalItems = items.length;
    const dateRange = this.getDateRange(items);
    const sources = [...new Set(items.map(item => item.source?.name).filter(Boolean))];
    
    let index = `# Newsletter Export\n\n`;
    index += `**Export Date:** ${new Date().toISOString().split('T')[0]}\n`;
    index += `**Total Items:** ${totalItems}\n`;
    index += `**Date Range:** ${dateRange.start} to ${dateRange.end}\n`;
    index += `**Sources:** ${sources.join(', ')}\n\n`;
    
    index += `## Table of Contents\n\n`;
    
    items.forEach((item, index_num) => {
      const title = item.title || 'Untitled';
      const source = item.source?.name || 'Unknown';
      const date = new Date(item.publishedAt || item.createdAt).toISOString().split('T')[0];
      
      index += `${index_num + 1}. **${title}** - ${source} (${date})\n`;
    });
    
    return index;
  }

  /**
   * Export items grouped by source
   * @param {Array} items - Newsletter items
   * @returns {string} Grouped markdown content
   */
  exportItemsGroupedBySource(items) {
    const grouped = items.reduce((acc, item) => {
      const sourceName = item.source?.name || 'Unknown Source';
      if (!acc[sourceName]) {
        acc[sourceName] = [];
      }
      acc[sourceName].push(item);
      return acc;
    }, {});

    let markdown = '';
    
    Object.entries(grouped).forEach(([sourceName, sourceItems]) => {
      markdown += `\n\n## ${sourceName}\n\n`;
      markdown += `*${sourceItems.length} newsletters from this source*\n\n`;
      
      sourceItems.forEach((item, index) => {
        markdown += `### ${index + 1}. ${item.title || 'Untitled'}\n\n`;
        markdown += this.generateItemMetadata(item);
        markdown += this.convertToMarkdown(item.content);
        markdown += '\n\n---\n\n';
      });
    });
    
    return markdown;
  }

  /**
   * Export items chronologically
   * @param {Array} items - Newsletter items
   * @returns {string} Chronological markdown content
   */
  exportItemsChronologically(items) {
    // Sort by date (newest first)
    const sortedItems = [...items].sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.createdAt);
      const dateB = new Date(b.publishedAt || b.createdAt);
      return dateB - dateA;
    });

    let markdown = '';
    
    sortedItems.forEach((item, index) => {
      markdown += `\n\n## ${index + 1}. ${item.title || 'Untitled'}\n\n`;
      markdown += this.generateItemMetadata(item);
      markdown += this.convertToMarkdown(item.content);
      markdown += '\n\n---\n\n';
    });
    
    return markdown;
  }

  /**
   * Generate metadata section for item
   * @param {Object} item - Newsletter item
   * @returns {string} Metadata markdown
   */
  generateItemMetadata(item) {
    const source = item.source || {};
    const publishDate = new Date(item.publishedAt || item.createdAt);
    
    let metadata = `**Source:** ${source.name || 'Unknown'}\n`;
    metadata += `**Date:** ${publishDate.toLocaleDateString()}\n`;
    
    if (item.url) {
      metadata += `**URL:** [${item.url}](${item.url})\n`;
    }
    
    if (item.metadata?.processing) {
      const processing = item.metadata.processing;
      if (processing.wordCount) {
        metadata += `**Word Count:** ${processing.wordCount}\n`;
      }
      if (processing.estimatedReadTime) {
        metadata += `**Reading Time:** ${processing.estimatedReadTime} minutes\n`;
      }
    }
    
    return metadata + '\n';
  }

  /**
   * Extract tags from item content and metadata
   * @param {Object} item - Newsletter item
   * @returns {Array} Array of tags
   */
  extractTags(item) {
    const tags = [];
    
    // Add source type as tag
    if (item.source?.type) {
      tags.push(item.source.type);
    }
    
    // Add domain-based tag if available
    if (item.metadata?.sender?.domain) {
      tags.push(item.metadata.sender.domain);
    }
    
    // Extract keywords from title (simple approach)
    if (item.title) {
      const titleWords = item.title
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4 && !/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|new|now|old|see|two|way|who|boy|did|may|she|use|your|each|make|most|over|said|some|time|very|what|with|have|from|they|know|want|been|good|much|some|take|than|them|well|were)$/.test(word));
      
      tags.push(...titleWords.slice(0, 3)); // Add up to 3 keywords
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Get date range from items
   * @param {Array} items - Newsletter items
   * @returns {Object} Date range
   */
  getDateRange(items) {
    if (items.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      return { start: today, end: today };
    }
    
    const dates = items.map(item => new Date(item.publishedAt || item.createdAt));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    return {
      start: minDate.toISOString().split('T')[0],
      end: maxDate.toISOString().split('T')[0]
    };
  }

  /**
   * Save markdown to file
   * @param {string} markdown - Markdown content
   * @param {string} filename - Output filename
   * @param {string} outputDir - Output directory
   * @returns {string} File path
   */
  async saveToFile(markdown, filename, outputDir = './exports') {
    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });
      
      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `newsletter-export-${timestamp}.md`;
      }
      
      // Ensure .md extension
      if (!filename.endsWith('.md')) {
        filename += '.md';
      }
      
      const filePath = path.join(outputDir, filename);
      
      // Write file
      await fs.writeFile(filePath, markdown, 'utf8');
      
      return filePath;
    } catch (error) {
      console.error('Failed to save markdown file:', error);
      throw new Error(`Failed to save markdown file: ${error.message}`);
    }
  }

  /**
   * Generate download-ready markdown buffer
   * @param {Array} items - Newsletter items
   * @param {Object} options - Export options
   * @returns {Object} Buffer and metadata
   */
  async generateDownload(items, options = {}) {
    const markdown = this.exportItems(items, options);
    const buffer = Buffer.from(markdown, 'utf8');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = options.filename || `newsletter-export-${timestamp}.md`;
    
    return {
      buffer,
      filename: filename.endsWith('.md') ? filename : `${filename}.md`,
      contentType: 'text/markdown',
      size: buffer.length
    };
  }
}

module.exports = MarkdownExporter;