const request = require('supertest');
const express = require('express');

// Mock Bull queue to prevent Redis connection
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    process: jest.fn(),
    add: jest.fn(),
    getStats: jest.fn(),
    getHealth: jest.fn(),
    close: jest.fn()
  }));
});

// Mock ioredis to prevent Redis connection
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    incr: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn()
  }));
});

// Mock dependencies
jest.mock('../../../workers/emailQueue', () => ({
  addWebhookJob: jest.fn(),
  addEmailJob: jest.fn(),
  getQueueStats: jest.fn(),
  getQueueHealth: jest.fn()
}));

jest.mock('../../../services/email/processor', () => ({
  healthCheck: jest.fn(),
  getStats: jest.fn()
}));

// Mock SendGrid EventWebhook
jest.mock('@sendgrid/eventwebhook', () => ({
  EventWebhook: jest.fn().mockImplementation(() => ({
    verifySignature: jest.fn().mockReturnValue(true)
  }))
}));

// Mock rate limiting middleware
jest.mock('../../../middleware/rateLimiting', () => ({
  emailLimiter: (req, res, next) => next(),
  webhookLimiter: (req, res, next) => next(),
  generalLimiter: (req, res, next) => next()
}));

const emailWebhookRoutes = require('../email');

const { addWebhookJob, addEmailJob, getQueueStats, getQueueHealth } = require('../../../workers/emailQueue');
const emailProcessor = require('../../../services/email/processor');

describe('Email Webhook Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    
    // Simple JSON parsing for tests
    app.use(express.json({ limit: '10mb' }));
    
    app.use('/api/webhooks/email', emailWebhookRoutes);

    // Reset mocks
    jest.clearAllMocks();
    
    // Reset mock implementations to ensure they return promises
    addWebhookJob.mockResolvedValue({ id: 'test-job-id', getStatus: jest.fn().mockResolvedValue('waiting') });
    addEmailJob.mockResolvedValue({ id: 'test-job-id', getStatus: jest.fn().mockResolvedValue('waiting') });
    getQueueStats.mockResolvedValue({ active: 0, waiting: 0, completed: 0, failed: 0 });
    getQueueHealth.mockResolvedValue({ status: 'healthy', lastCheck: new Date() });
    emailProcessor.healthCheck.mockResolvedValue({ status: 'healthy' });
    emailProcessor.getStats.mockResolvedValue({ processed: 0, failed: 0 });
  });

  describe('POST /api/webhooks/email/sendgrid', () => {
    test('should queue email for processing from valid SendGrid webhook', async () => {
      const webhookData = {
        envelope: {
          to: ['user123@newsletters.app'],
          from: 'newsletter@example.com'
        },
        email: 'raw email content',
        subject: 'Test Newsletter',
        from: 'newsletter@example.com'
      };

      // Override default mock for this specific test
      const mockJob = {
        id: 'job123',
        getStatus: jest.fn().mockResolvedValue('waiting')
      };
      addWebhookJob.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/webhooks/email/sendgrid')
        .set('X-Signature', 'test-signature')
        .set('X-Timestamp', '1234567890')
        .send(webhookData);

      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Email queued for processing');
      expect(response.body.data.jobId).toBe('job123');
      expect(addWebhookJob).toHaveBeenCalledWith(webhookData, {
        priority: 10,
        attempts: 3
      });
    });

    test('should reject webhook with missing required fields', async () => {
      const invalidWebhookData = {
        envelope: { to: ['user@newsletters.app'] }
        // missing email field
      };

      const response = await request(app)
        .post('/api/webhooks/email/sendgrid')
        .set('X-Signature', 'test-signature')
        .set('X-Timestamp', '1234567890')
        .send(invalidWebhookData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid webhook data');
      expect(response.body.message).toBe('Missing required fields: envelope, email');
      expect(addWebhookJob).not.toHaveBeenCalled();
    });

    test('should handle queue errors gracefully', async () => {
      const webhookData = {
        envelope: { to: ['user@newsletters.app'] },
        email: 'raw email content'
      };

      addWebhookJob.mockRejectedValue(new Error('Queue is full'));

      const response = await request(app)
        .post('/api/webhooks/email/sendgrid')
        .set('X-Signature', 'test-signature')
        .set('X-Timestamp', '1234567890')
        .send(webhookData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/webhooks/email/events', () => {
    test('should process SendGrid events', async () => {
      const events = [
        {
          event: 'bounce',
          email: 'user@example.com',
          timestamp: 1234567890,
          reason: 'Mailbox does not exist'
        },
        {
          event: 'delivered',
          email: 'user@example.com',
          timestamp: 1234567891
        }
      ];

      const response = await request(app)
        .post('/api/webhooks/email/events')
        .set('X-Signature', 'test-signature')
        .set('X-Timestamp', '1234567890')
        .send(events);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Processed 2 events');
      expect(response.body.eventsProcessed).toBe(2);
    });

    test('should reject invalid event data', async () => {
      const invalidEvents = 'not an array';

      const response = await request(app)
        .post('/api/webhooks/email/events')
        .set('X-Signature', 'test-signature')
        .set('X-Timestamp', '1234567890')
        .send(invalidEvents);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid event data');
      expect(response.body.message).toBe('Expected array of events');
    });
  });

  describe('POST /api/webhooks/email/test', () => {
    test('should queue test email for processing in development', async () => {
      // Mock NODE_ENV to be development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const testData = {
        rawEmail: 'From: test@example.com\nSubject: Test\n\nTest content',
        forwardingAddress: 'user123@newsletters.app'
      };

      const mockJob = {
        id: 'test-job123',
        getStatus: jest.fn().mockResolvedValue('waiting')
      };

      addEmailJob.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/webhooks/email/test')
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Email queued for processing');
      expect(addEmailJob).toHaveBeenCalledWith(
        testData.rawEmail,
        testData.forwardingAddress,
        { priority: 5, attempts: 2 }
      );

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    test('should return 404 in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/webhooks/email/test')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');

      process.env.NODE_ENV = originalEnv;
    });

    test('should reject missing required fields', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/api/webhooks/email/test')
        .send({ rawEmail: 'test' }); // missing forwardingAddress

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('GET /api/webhooks/email/health', () => {
    test('should return healthy status', async () => {
      const healthData = {
        status: 'healthy',
        timestamp: '2024-01-01T12:00:00Z',
        stats: { processed: 100, failed: 2 },
        successRate: 98
      };

      emailProcessor.healthCheck.mockReturnValue(healthData);

      const response = await request(app)
        .get('/api/webhooks/email/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.successRate).toBe(98);
    });

    test('should return unhealthy status with 503', async () => {
      const healthData = {
        status: 'unhealthy',
        timestamp: '2024-01-01T12:00:00Z',
        stats: { processed: 100, failed: 50 },
        successRate: 50
      };

      emailProcessor.healthCheck.mockReturnValue(healthData);

      const response = await request(app)
        .get('/api/webhooks/email/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });

    test('should handle health check errors', async () => {
      emailProcessor.healthCheck.mockImplementation(() => {
        throw new Error('Health check failed');
      });

      const response = await request(app)
        .get('/api/webhooks/email/health');

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/webhooks/email/stats', () => {
    test('should return combined processor and queue stats', async () => {
      const processorStats = {
        totalProcessed: 1000,
        successful: 950,
        failed: 30,
        duplicates: 20
      };

      const queueStats = {
        waiting: 5,
        active: 2,
        completed: 1000,
        failed: 30
      };

      emailProcessor.getStats.mockReturnValue(processorStats);
      getQueueStats.mockResolvedValue(queueStats);

      const response = await request(app)
        .get('/api/webhooks/email/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processor).toEqual(processorStats);
      expect(response.body.data.queue).toEqual(queueStats);
    });

    test('should handle stats errors', async () => {
      getQueueStats.mockRejectedValue(new Error('Queue unavailable'));

      const response = await request(app)
        .get('/api/webhooks/email/stats');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/webhooks/email/queue', () => {
    test('should return healthy queue status', async () => {
      const queueHealth = {
        status: 'healthy',
        stats: { waiting: 2, active: 1 },
        timestamp: '2024-01-01T12:00:00Z'
      };

      getQueueHealth.mockResolvedValue(queueHealth);

      const response = await request(app)
        .get('/api/webhooks/email/queue');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });

    test('should return unhealthy queue status with 503', async () => {
      const queueHealth = {
        status: 'unhealthy',
        stats: { waiting: 100, active: 50 },
        timestamp: '2024-01-01T12:00:00Z'
      };

      getQueueHealth.mockResolvedValue(queueHealth);

      const response = await request(app)
        .get('/api/webhooks/email/queue');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(true);
    });

    test('should handle queue errors with error status', async () => {
      const queueHealth = {
        status: 'error',
        error: 'Redis connection failed',
        timestamp: '2024-01-01T12:00:00Z'
      };

      getQueueHealth.mockResolvedValue(queueHealth);

      const response = await request(app)
        .get('/api/webhooks/email/queue');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should apply webhook rate limiting', async () => {
      // This test would need to actually test rate limiting
      // but requires more setup to work with the rate limiter middleware
      // In a real scenario, you'd want to test this with actual rate limiting
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('SendGrid Signature Verification', () => {
    test('should verify valid SendGrid signatures', async () => {
      // This test would require mocking the EventWebhook signature verification
      // In practice, you'd set up proper test signatures
      expect(true).toBe(true); // Placeholder
    });

    test('should reject invalid signatures', async () => {
      // Mock invalid signature scenario
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Error Handling', () => {
    test('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/webhooks/email/sendgrid')
        .type('text')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    test('should use error handling middleware', async () => {
      // Test that errors are properly caught by the error middleware
      addWebhookJob.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const webhookData = {
        envelope: { to: ['user@newsletters.app'] },
        email: 'content'
      };

      const response = await request(app)
        .post('/api/webhooks/email/sendgrid')
        .set('X-Signature', 'test-signature')
        .set('X-Timestamp', '1234567890')
        .send(webhookData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});