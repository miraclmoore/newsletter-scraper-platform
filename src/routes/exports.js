const express = require('express');
const MarkdownExporter = require('../services/exports/markdownExporter');
const CSVExporter = require('../services/exports/csvExporter');
const ItemModel = require('../models/supabase/Item');
const { authenticateToken } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(generalLimiter);

// Initialize exporters
const markdownExporter = new MarkdownExporter();
const csvExporter = new CSVExporter();

/**
 * POST /api/exports/markdown
 * Export newsletters to Markdown format
 */
router.post('/markdown', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      itemIds,
      dateRange,
      sourceId,
      options = {}
    } = req.body;

    // Validate request
    if (!itemIds && !dateRange && !sourceId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Must provide itemIds, dateRange, or sourceId for export'
      });
    }

    // Fetch items based on criteria
    const items = await fetchItemsForExport(userId, { itemIds, dateRange, sourceId });

    if (items.length === 0) {
      return res.status(404).json({
        error: 'No items found',
        message: 'No newsletter items match the specified criteria'
      });
    }

    // Generate Markdown export
    const exportData = await markdownExporter.generateDownload(items, {
      groupBySource: options.groupBySource || false,
      includeIndex: options.includeIndex !== false, // default true
      filename: options.filename
    });

    // Set response headers for download
    res.set({
      'Content-Type': exportData.contentType,
      'Content-Disposition': `attachment; filename="${exportData.filename}"`,
      'Content-Length': exportData.size
    });

    // Send file
    res.send(exportData.buffer);

    console.log('Markdown export completed:', {
      userId,
      itemCount: items.length,
      filename: exportData.filename,
      size: exportData.size
    });

  } catch (error) {
    console.error('Markdown export failed:', error);
    
    return res.status(500).json({
      error: 'Export failed',
      message: 'Failed to generate Markdown export'
    });
  }
});

/**
 * POST /api/exports/csv
 * Export newsletters to CSV format
 */
router.post('/csv', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      itemIds,
      dateRange,
      sourceId,
      options = {}
    } = req.body;

    // Validate request
    if (!itemIds && !dateRange && !sourceId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Must provide itemIds, dateRange, or sourceId for export'
      });
    }

    // Fetch items
    const items = await fetchItemsForExport(userId, { itemIds, dateRange, sourceId });

    if (items.length === 0) {
      return res.status(404).json({
        error: 'No items found',
        message: 'No newsletter items match the specified criteria'
      });
    }

    // Validate export size
    const validation = csvExporter.validateItems(items);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation error',
        message: validation.error
      });
    }

    // Generate CSV export
    const exportData = await csvExporter.generateDownload(items, {
      includeContent: options.includeContent !== false, // default true
      includeSummary: options.includeSummary || false,
      dateFormat: options.dateFormat || 'iso',
      filename: options.filename
    });

    // Set response headers for download
    res.set({
      'Content-Type': exportData.contentType,
      'Content-Disposition': `attachment; filename="${exportData.filename}"`,
      'Content-Length': exportData.size
    });

    // Send file
    res.send(exportData.buffer);

    console.log('CSV export completed:', {
      userId,
      itemCount: items.length,
      filename: exportData.filename,
      size: exportData.size
    });

  } catch (error) {
    console.error('CSV export failed:', error);
    
    return res.status(500).json({
      error: 'Export failed',
      message: 'Failed to generate CSV export'
    });
  }
});

/**
 * GET /api/exports/preview
 * Preview export data without generating file
 */
router.get('/preview', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      itemIds,
      dateRange,
      sourceId,
      limit = 5 // Preview only first 5 items
    } = req.query;

    if (!itemIds && !dateRange && !sourceId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Must provide itemIds, dateRange, or sourceId for preview'
      });
    }

    // Parse parameters
    const parsedParams = {
      itemIds: itemIds ? itemIds.split(',') : undefined,
      dateRange: dateRange ? JSON.parse(dateRange) : undefined,
      sourceId,
      limit: parseInt(limit)
    };

    // Fetch items
    const allItems = await fetchItemsForExport(userId, parsedParams);
    const previewItems = allItems.slice(0, parsedParams.limit);

    // Generate preview data
    const preview = {
      totalItems: allItems.length,
      previewItems: previewItems.length,
      dateRange: getDateRange(allItems),
      sources: getUniqueSources(allItems),
      estimatedSizes: {
        markdown: estimateMarkdownSize(allItems),
        csv: estimateCSVSize(allItems)
      },
      sampleData: previewItems.map(item => ({
        id: item.id,
        title: item.title,
        source: item.source?.name,
        publishedAt: item.publishedAt,
        wordCount: item.metadata?.processing?.wordCount || 0,
        excerpt: item.excerpt || 'No excerpt available'
      }))
    };

    return res.status(200).json({
      success: true,
      data: preview
    });

  } catch (error) {
    console.error('Export preview failed:', error);
    
    return res.status(500).json({
      error: 'Preview failed',
      message: 'Failed to generate export preview'
    });
  }
});

/**
 * GET /api/exports/formats
 * Get available export formats and their capabilities
 */
router.get('/formats', (req, res) => {
  const formats = {
    markdown: {
      name: 'Markdown',
      extension: '.md',
      description: 'Structured text format ideal for documentation and note-taking',
      features: [
        'Preserves formatting and links',
        'YAML front matter with metadata',
        'Table of contents generation',
        'Grouping by source or chronological',
        'Human-readable format'
      ],
      options: {
        groupBySource: 'Group newsletters by source (boolean)',
        includeIndex: 'Include table of contents (boolean, default: true)',
        filename: 'Custom filename (string)'
      }
    },
    csv: {
      name: 'CSV (Comma Separated Values)',
      extension: '.csv',
      description: 'Spreadsheet format for data analysis and processing',
      features: [
        'Structured tabular data',
        'Excel compatible',
        'Summary statistics available',
        'Customizable fields',
        'Machine-readable format'
      ],
      options: {
        includeContent: 'Include full content (boolean, default: true)',
        includeSummary: 'Include summary statistics (boolean)',
        dateFormat: 'Date format: iso, date, readable, timestamp',
        filename: 'Custom filename (string)'
      },
      limits: {
        maxItems: 10000,
        maxSize: '50MB'
      }
    }
  };

  return res.status(200).json({
    success: true,
    data: formats
  });
});

/**
 * Fetch items for export based on criteria
 * @param {string} userId - User ID
 * @param {Object} criteria - Export criteria
 * @returns {Array} Newsletter items
 */
async function fetchItemsForExport(userId, criteria) {
  const { itemIds, dateRange, sourceId, limit } = criteria;

  try {
    let query = ItemModel.supabase
      .from(ItemModel.tableName)
      .select(`
        *,
        source:sources(*)
      `)
      .eq('user_id', userId)
      .order('published_at', { ascending: false });

    // Apply filters
    if (itemIds && Array.isArray(itemIds)) {
      query = query.in('id', itemIds);
    }

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    if (dateRange) {
      if (dateRange.start) {
        query = query.gte('published_at', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('published_at', dateRange.end);
      }
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(item => ItemModel.formatItem(item));

  } catch (error) {
    console.error('Failed to fetch items for export:', error);
    throw new Error('Failed to fetch newsletter items');
  }
}

/**
 * Get date range from items
 * @param {Array} items - Newsletter items
 * @returns {Object} Date range
 */
function getDateRange(items) {
  if (items.length === 0) {
    return { start: null, end: null };
  }

  const dates = items.map(item => new Date(item.publishedAt || item.createdAt));
  return {
    start: new Date(Math.min(...dates)).toISOString(),
    end: new Date(Math.max(...dates)).toISOString()
  };
}

/**
 * Get unique sources from items
 * @param {Array} items - Newsletter items
 * @returns {Array} Unique sources
 */
function getUniqueSources(items) {
  const sources = new Map();
  
  items.forEach(item => {
    if (item.source) {
      sources.set(item.source.id, {
        id: item.source.id,
        name: item.source.name,
        type: item.source.type,
        count: (sources.get(item.source.id)?.count || 0) + 1
      });
    }
  });

  return Array.from(sources.values());
}

/**
 * Estimate Markdown export file size
 * @param {Array} items - Newsletter items
 * @returns {Object} Size estimation
 */
function estimateMarkdownSize(items) {
  let totalChars = 0;

  items.forEach(item => {
    // Estimate front matter (YAML): ~200 chars
    totalChars += 200;
    
    // Title and metadata: ~100 chars
    totalChars += 100;
    
    // Content length (HTML to Markdown conversion reduces size by ~30%)
    const contentLength = (item.content || '').length;
    totalChars += Math.floor(contentLength * 0.7);
    
    // Separators and formatting: ~50 chars
    totalChars += 50;
  });

  // Add index and headers
  totalChars += 1000;

  return {
    estimatedChars: totalChars,
    estimatedBytes: totalChars,
    estimatedKB: Math.ceil(totalChars / 1024),
    estimatedMB: Math.ceil(totalChars / (1024 * 1024))
  };
}

/**
 * Estimate CSV export file size
 * @param {Array} items - Newsletter items
 * @returns {Object} Size estimation
 */
function estimateCSVSize(items) {
  const avgRowSize = 1500; // Estimated average row size in bytes
  const headerSize = 200; // CSV header size
  
  const estimatedBytes = headerSize + (items.length * avgRowSize);

  return {
    estimatedRows: items.length + 1, // +1 for header
    estimatedBytes,
    estimatedKB: Math.ceil(estimatedBytes / 1024),
    estimatedMB: Math.ceil(estimatedBytes / (1024 * 1024))
  };
}

module.exports = router;