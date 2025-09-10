const request = require('supertest');
const express = require('express');
const sourcesRoutes = require('../sources');

// Mock dependencies
jest.mock('../../models/supabase/Source', () => ({
  findByUser: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../../services/rss/parser', () => ({
  validateFeed: jest.fn(),
  discoverFeeds: jest.fn()
}));

jest.mock('../../services/rss/poller', () => ({
  pollFeed: jest.fn()
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-123' };
    next();
  }
}));

jest.mock('../../middleware/rateLimiting', () => ({
  generalLimiter: (req, res, next) => next()
}));

const SourceModel = require('../../models/supabase/Source');
const rssParser = require('../../services/rss/parser');
const rssPoller = require('../../services/rss/poller');

describe('Sources Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sources', sourcesRoutes);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /api/sources', () => {
    test('should return user sources', async () => {
      const mockSources = [
        {
          id: 'source-1',
          userId: 'test-user-123',
          type: 'rss',
          name: 'Test Feed',
          isActive: true
        },
        {
          id: 'source-2',
          userId: 'test-user-123',
          type: 'gmail',
          name: 'Gmail',
          isActive: true
        }
      ];

      SourceModel.findByUser.mockResolvedValue(mockSources);

      const response = await request(app)
        .get('/api/sources');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSources);
      expect(response.body.count).toBe(2);
      expect(SourceModel.findByUser).toHaveBeenCalledWith('test-user-123', {});
    });

    test('should filter sources by type', async () => {
      const mockRSSSources = [
        {
          id: 'source-1',
          type: 'rss',
          name: 'RSS Feed'
        }
      ];

      SourceModel.findByUser.mockResolvedValue(mockRSSSources);

      const response = await request(app)
        .get('/api/sources?type=rss');

      expect(response.status).toBe(200);
      expect(SourceModel.findByUser).toHaveBeenCalledWith('test-user-123', { type: 'rss' });
    });

    test('should handle database errors', async () => {
      SourceModel.findByUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/sources');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/sources/:id', () => {
    test('should return specific source', async () => {
      const mockSource = {
        id: 'source-1',
        userId: 'test-user-123',
        type: 'rss',
        name: 'Test Feed'
      };

      SourceModel.findById.mockResolvedValue(mockSource);

      const response = await request(app)
        .get('/api/sources/source-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSource);
    });

    test('should return 404 for non-existent source', async () => {
      SourceModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/sources/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });

    test('should return 403 for unauthorized access', async () => {
      const mockSource = {
        id: 'source-1',
        userId: 'different-user',
        type: 'rss',
        name: 'Test Feed'
      };

      SourceModel.findById.mockResolvedValue(mockSource);

      const response = await request(app)
        .get('/api/sources/source-1');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('POST /api/sources', () => {
    test('should create RSS source successfully', async () => {
      const feedData = {
        title: 'Test Feed',
        description: 'A test RSS feed',
        link: 'https://example.com',
        itemCount: 5,
        language: 'en'
      };

      const mockSource = {
        id: 'source-1',
        userId: 'test-user-123',
        type: 'rss',
        name: 'Test Feed',
        configuration: {
          url: 'https://example.com/feed.xml',
          ...feedData
        }
      };

      rssParser.validateFeed.mockResolvedValue({
        valid: true,
        feedData: feedData
      });

      SourceModel.create.mockResolvedValue(mockSource);
      rssPoller.pollFeed.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/sources')
        .send({
          type: 'rss',
          name: 'Custom Name',
          configuration: {
            url: 'https://example.com/feed.xml'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSource);
      expect(rssParser.validateFeed).toHaveBeenCalledWith('https://example.com/feed.xml');
      expect(SourceModel.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'test-user-123',
        type: 'rss',
        name: 'Test Feed', // Should use feed title
        configuration: expect.objectContaining({
          url: 'https://example.com/feed.xml'
        })
      }));
    });

    test('should reject invalid RSS feed', async () => {
      rssParser.validateFeed.mockResolvedValue({
        valid: false,
        error: 'Invalid XML format'
      });

      const response = await request(app)
        .post('/api/sources')
        .send({
          type: 'rss',
          name: 'Test Feed',
          configuration: {
            url: 'https://example.com/invalid.xml'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid RSS feed');
      expect(response.body.message).toBe('Invalid XML format');
      expect(SourceModel.create).not.toHaveBeenCalled();
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/sources')
        .send({
          name: 'Test Feed'
          // Missing type
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toBe('Type and name are required');
    });

    test('should reject unsupported source types', async () => {
      const response = await request(app)
        .post('/api/sources')
        .send({
          type: 'unsupported',
          name: 'Test Source'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toContain('Unsupported source type');
    });

    test('should require RSS URL for RSS sources', async () => {
      const response = await request(app)
        .post('/api/sources')
        .send({
          type: 'rss',
          name: 'Test Feed',
          configuration: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toBe('RSS URL is required in configuration');
    });
  });

  describe('PUT /api/sources/:id', () => {
    test('should update source successfully', async () => {
      const existingSource = {
        id: 'source-1',
        userId: 'test-user-123',
        type: 'rss',
        name: 'Old Name'
      };

      const updatedSource = {
        ...existingSource,
        name: 'New Name'
      };

      SourceModel.findById.mockResolvedValue(existingSource);
      SourceModel.update.mockResolvedValue(updatedSource);

      const response = await request(app)
        .put('/api/sources/source-1')
        .send({
          name: 'New Name'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedSource);
      expect(SourceModel.update).toHaveBeenCalledWith('source-1', {
        name: 'New Name'
      });
    });

    test('should validate RSS URL when updating RSS source', async () => {
      const existingSource = {
        id: 'source-1',
        userId: 'test-user-123',
        type: 'rss',
        configuration: { url: 'https://old.com/feed.xml' },
        metadata: {}
      };

      const feedData = {
        title: 'Updated Feed',
        description: 'Updated description',
        link: 'https://new.com',
        itemCount: 3,
        language: 'en'
      };

      SourceModel.findById.mockResolvedValue(existingSource);
      rssParser.validateFeed.mockResolvedValue({
        valid: true,
        feedData: feedData
      });
      SourceModel.update.mockResolvedValue({});

      const response = await request(app)
        .put('/api/sources/source-1')
        .send({
          configuration: {
            url: 'https://new.com/feed.xml'
          }
        });

      expect(response.status).toBe(200);
      expect(rssParser.validateFeed).toHaveBeenCalledWith('https://new.com/feed.xml');
    });

    test('should return 404 for non-existent source', async () => {
      SourceModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/sources/nonexistent')
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });

    test('should return 403 for unauthorized access', async () => {
      const source = {
        id: 'source-1',
        userId: 'different-user',
        type: 'rss'
      };

      SourceModel.findById.mockResolvedValue(source);

      const response = await request(app)
        .put('/api/sources/source-1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/sources/:id', () => {
    test('should delete source successfully', async () => {
      const existingSource = {
        id: 'source-1',
        userId: 'test-user-123',
        type: 'rss'
      };

      SourceModel.findById.mockResolvedValue(existingSource);
      SourceModel.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/sources/source-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(SourceModel.delete).toHaveBeenCalledWith('source-1');
    });

    test('should return 404 for non-existent source', async () => {
      SourceModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/sources/nonexistent');

      expect(response.status).toBe(404);
    });

    test('should return 403 for unauthorized access', async () => {
      const source = {
        id: 'source-1',
        userId: 'different-user'
      };

      SourceModel.findById.mockResolvedValue(source);

      const response = await request(app)
        .delete('/api/sources/source-1');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/sources/:id/poll', () => {
    test('should manually poll RSS source', async () => {
      const rssSource = {
        id: 'source-1',
        userId: 'test-user-123',
        type: 'rss'
      };

      SourceModel.findById.mockResolvedValue(rssSource);
      rssPoller.pollFeed.mockResolvedValue({
        success: true,
        message: 'Polled successfully'
      });

      const response = await request(app)
        .post('/api/sources/source-1/poll');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(rssPoller.pollFeed).toHaveBeenCalledWith('source-1');
    });

    test('should reject polling non-RSS sources', async () => {
      const gmailSource = {
        id: 'source-1',
        userId: 'test-user-123',
        type: 'gmail'
      };

      SourceModel.findById.mockResolvedValue(gmailSource);

      const response = await request(app)
        .post('/api/sources/source-1/poll');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid operation');
      expect(response.body.message).toBe('Only RSS sources can be polled');
    });

    test('should handle polling failures', async () => {
      const rssSource = {
        id: 'source-1',
        userId: 'test-user-123',
        type: 'rss'
      };

      SourceModel.findById.mockResolvedValue(rssSource);
      rssPoller.pollFeed.mockResolvedValue({
        success: false,
        error: 'Feed is unreachable'
      });

      const response = await request(app)
        .post('/api/sources/source-1/poll');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Polling failed');
      expect(response.body.message).toBe('Feed is unreachable');
    });
  });

  describe('POST /api/sources/validate-rss', () => {
    test('should validate RSS feed URL', async () => {
      const feedData = {
        title: 'Valid Feed',
        description: 'A valid RSS feed',
        itemCount: 10
      };

      rssParser.validateFeed.mockResolvedValue({
        valid: true,
        feedData: feedData
      });

      const response = await request(app)
        .post('/api/sources/validate-rss')
        .send({
          url: 'https://example.com/feed.xml'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.data).toEqual(feedData);
    });

    test('should return validation failure', async () => {
      rssParser.validateFeed.mockResolvedValue({
        valid: false,
        error: 'Invalid XML format'
      });

      const response = await request(app)
        .post('/api/sources/validate-rss')
        .send({
          url: 'https://example.com/invalid.xml'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Invalid XML format');
    });

    test('should require URL parameter', async () => {
      const response = await request(app)
        .post('/api/sources/validate-rss')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.message).toBe('URL is required');
    });
  });

  describe('POST /api/sources/discover-feeds', () => {
    test('should discover RSS feeds from webpage', async () => {
      const mockFeeds = [
        { url: 'https://example.com/feed.xml', title: 'Main Feed' },
        { url: 'https://example.com/atom.xml', title: 'Atom Feed' }
      ];

      rssParser.discoverFeeds.mockResolvedValue(mockFeeds);

      const response = await request(app)
        .post('/api/sources/discover-feeds')
        .send({
          url: 'https://example.com/blog'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockFeeds);
      expect(response.body.count).toBe(2);
      expect(response.body.message).toBe('Found 2 RSS feeds');
    });

    test('should handle no feeds found', async () => {
      rssParser.discoverFeeds.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/sources/discover-feeds')
        .send({
          url: 'https://example.com/no-feeds'
        });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.message).toBe('Found 0 RSS feeds');
    });

    test('should require URL parameter', async () => {
      const response = await request(app)
        .post('/api/sources/discover-feeds')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/sources/stats', () => {
    test('should return source statistics', async () => {
      const mockSources = [
        { type: 'rss', isActive: true, itemCount: 10, syncStatus: 'success' },
        { type: 'rss', isActive: true, itemCount: 5, syncStatus: 'success' },
        { type: 'gmail', isActive: false, itemCount: 20, syncStatus: 'error' }
      ];

      SourceModel.findByUser.mockResolvedValue(mockSources);

      const response = await request(app)
        .get('/api/sources/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        total: 3,
        active: 2,
        byType: {
          rss: 2,
          gmail: 1
        },
        byStatus: {
          success: 2,
          error: 1
        },
        totalItems: 35
      });
    });
  });
});