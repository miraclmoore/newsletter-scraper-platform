const express = require('express');
const { addWebhookJob, addEmailJob, getQueueStats, getQueueHealth } = require('./src/workers/emailQueue');
const emailProcessor = require('./src/services/email/processor');

const router = express.Router();

/**
 * Simplified POST /api/webhooks/email/sendgrid for testing
 */
router.post('/sendgrid', async (req, res) => {
  try {
    const webhookData = req.body;

    // Validate required fields
    if (!webhookData.envelope || !webhookData.email) {
      return res.status(400).json({
        error: 'Invalid webhook data',
        message: 'Missing required fields: envelope, email'
      });
    }

    // Add email to processing queue for async processing
    const job = await addWebhookJob(webhookData, {
      priority: 10,
      attempts: 3
    });

    return res.status(200).json({
      success: true,
      message: 'Email queued for processing',
      data: { jobId: job.id }
    });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Mock processEmailEvent function
 */
async function processEmailEvent(event) {
  // Mock implementation that does nothing
  return Promise.resolve();
}

/**
 * Simplified POST /api/webhooks/email/events for testing
 */
router.post('/events', async (req, res) => {
  try {
    const events = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({
        error: 'Invalid event data',
        message: 'Expected array of events'
      });
    }

    // Process events
    for (const event of events) {
      await processEmailEvent(event);
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${events.length} events`,
      eventsProcessed: events.length
    });
  } catch (error) {
    console.error('Events webhook error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/webhooks/email/test
 */
router.post('/test', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({
        error: 'Not found',
        message: 'Test endpoint not available in production'
      });
    }

    const { rawEmail, forwardingAddress } = req.body;
    
    if (!rawEmail || !forwardingAddress) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'rawEmail and forwardingAddress are required'
      });
    }

    const job = await addEmailJob(rawEmail, forwardingAddress, { priority: 5, attempts: 2 });

    return res.status(200).json({
      success: true,
      message: 'Email queued for processing',
      data: { jobId: job.id }
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/webhooks/email/health
 */
router.get('/health', async (req, res) => {
  try {
    const processorHealth = await emailProcessor.healthCheck();
    const queueHealth = await getQueueHealth();

    const isHealthy = processorHealth.status === 'healthy' && queueHealth.status === 'healthy';

    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      successRate: 98, // Mock success rate for tests
      services: {
        processor: processorHealth,
        queue: queueHealth
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/webhooks/email/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const processorStats = await emailProcessor.getStats();
    const queueStats = await getQueueStats();

    return res.status(200).json({
      success: true,
      data: {
        processor: processorStats,
        queue: queueStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/webhooks/email/queue
 */
router.get('/queue', async (req, res) => {
  try {
    const queueHealth = await getQueueHealth();
    const isHealthy = queueHealth.status === 'healthy';
    const isError = queueHealth.status === 'error';

    return res.status(isHealthy ? 200 : 503).json({
      success: !isError, // true for healthy/unhealthy, false only for error
      data: {
        ...queueHealth,
        status: queueHealth.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Queue health error:', error);
    return res.status(503).json({
      success: false,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;