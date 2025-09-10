const express = require('express');
const { EventWebhook } = require('@sendgrid/eventwebhook');
const emailProcessor = require('../../services/email/processor');
const { addWebhookJob, addEmailJob, getQueueStats, getQueueHealth } = require('../../workers/emailQueue');
const { emailLimiter, webhookLimiter } = require('../../middleware/rateLimiting');

const router = express.Router();

// SendGrid Event Webhook verification
let eventWebhook;
if (process.env.SENDGRID_WEBHOOK_SECRET) {
  eventWebhook = new EventWebhook();
}

/**
 * Middleware to verify SendGrid webhook signature
 */
const verifySendGridSignature = (req, res, next) => {
  if (!eventWebhook || !process.env.SENDGRID_WEBHOOK_SECRET) {
    console.warn('SendGrid webhook verification disabled - no secret configured');
    return next();
  }

  try {
    const signature = req.get('X-Signature');
    const timestamp = req.get('X-Timestamp');
    
    if (!signature || !timestamp) {
      return res.status(400).json({
        error: 'Missing required headers',
        message: 'X-Signature and X-Timestamp headers are required'
      });
    }

    // Get raw body for signature verification
    const payload = req.rawBody || req.body;
    const isValid = eventWebhook.verifySignature(
      payload,
      signature,
      timestamp,
      process.env.SENDGRID_WEBHOOK_SECRET
    );

    if (!isValid) {
      console.error('Invalid SendGrid webhook signature');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook signature'
      });
    }

    next();
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return res.status(400).json({
      error: 'Signature verification failed',
      message: error.message
    });
  }
};

/**
 * Middleware to capture raw body for signature verification
 */
const captureRawBody = (req, res, next) => {
  req.rawBody = '';
  req.on('data', chunk => {
    req.rawBody += chunk;
  });
  req.on('end', () => {
    next();
  });
};

/**
 * POST /api/webhooks/email/sendgrid
 * Handle incoming emails from SendGrid Inbound Parse Webhook
 */
router.post('/sendgrid', 
  webhookLimiter,
  captureRawBody,
  verifySendGridSignature,
  async (req, res) => {
    try {
      console.log('Received SendGrid webhook:', {
        headers: req.headers,
        bodyKeys: Object.keys(req.body)
      });

      // SendGrid sends parsed email data in the webhook
      const webhookData = req.body;

      // Validate required fields
      if (!webhookData.envelope || !webhookData.email) {
        return res.status(400).json({
          error: 'Invalid webhook data',
          message: 'Missing required fields: envelope, email'
        });
      }

      // Add email to processing queue for async processing
      let job;
      try {
        job = await addWebhookJob(webhookData, {
          priority: 10, // High priority for real-time webhooks
          attempts: 3
        });
      } catch (queueError) {
        console.error('Failed to add job to queue:', queueError.message);
        // Process synchronously if queue is unavailable
        const emailProcessor = require('../../services/email/processor');
        const result = await emailProcessor.processWebhookEmail(webhookData);
        
        return res.status(200).json({
          success: true,
          message: 'Email processed synchronously (queue unavailable)',
          data: {
            result,
            queueError: queueError.message
          }
        });
      }

      console.log('Email queued for processing:', {
        jobId: job.id,
        webhookData: {
          envelope: webhookData.envelope,
          subject: webhookData.subject
        }
      });

      // Return success immediately to SendGrid
      return res.status(200).json({
        success: true,
        message: 'Email queued for processing',
        data: {
          jobId: job.id,
          queuePosition: await job.getStatus()
        }
      });

    } catch (error) {
      console.error('SendGrid webhook error:', error);
      
      return res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  }
);

/**
 * POST /api/webhooks/email/events
 * Handle SendGrid event webhook (bounces, spam reports, etc.)
 */
router.post('/events',
  webhookLimiter,
  captureRawBody,
  verifySendGridSignature,
  async (req, res) => {
    try {
      console.log('Received SendGrid events webhook');
      
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
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  }
);

/**
 * POST /api/webhooks/email/test
 * Test endpoint for development and testing
 */
router.post('/test',
  emailLimiter,
  async (req, res) => {
    // Allow test endpoint in production for demo purposes
    try {
      return res.status(200).json({
        success: true,
        message: 'Test endpoint working',
        data: {
          body: req.body,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Test endpoint error',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/webhooks/email/test-original
 * Original test endpoint behavior (disabled in production)
 */
router.post('/test-original',
  emailLimiter,
  async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({
        error: 'Not found',
        message: 'Test endpoint not available in production'
      });
    }

    try {
      const { rawEmail, forwardingAddress } = req.body;

      if (!rawEmail || !forwardingAddress) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'rawEmail and forwardingAddress are required'
        });
      }

      // Add email to processing queue
      const job = await addEmailJob(rawEmail, forwardingAddress, {
        priority: 5, // Medium priority for test emails
        attempts: 2
      });

      return res.status(200).json({
        success: true,
        message: 'Email queued for processing',
        data: {
          jobId: job.id,
          queuePosition: await job.getStatus()
        }
      });

    } catch (error) {
      console.error('Test webhook error:', error);
      
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/webhooks/email/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  try {
    const health = emailProcessor.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    return res.status(statusCode).json({
      status: health.status,
      timestamp: health.timestamp,
      stats: health.stats,
      successRate: health.successRate
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * GET /api/webhooks/email/stats
 * Get processing statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const processorStats = emailProcessor.getStats();
    const queueStats = await getQueueStats();
    
    return res.status(200).json({
      success: true,
      data: {
        processor: processorStats,
        queue: queueStats
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats endpoint error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/webhooks/email/queue
 * Get queue status and health
 */
router.get('/queue', async (req, res) => {
  try {
    const health = await getQueueHealth();
    
    return res.status(health.status === 'healthy' ? 200 : 503).json({
      success: health.status !== 'error',
      data: health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Queue endpoint error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Process email events from SendGrid
 * @param {Object} event - SendGrid event data
 */
async function processEmailEvent(event) {
  try {
    console.log('Processing email event:', {
      event: event.event,
      email: event.email,
      timestamp: event.timestamp
    });

    // Handle different event types
    switch (event.event) {
      case 'bounce':
        await handleBounceEvent(event);
        break;
      case 'dropped':
        await handleDroppedEvent(event);
        break;
      case 'spam_report':
        await handleSpamReportEvent(event);
        break;
      case 'unsubscribe':
        await handleUnsubscribeEvent(event);
        break;
      default:
        console.log('Unhandled event type:', event.event);
    }

  } catch (error) {
    console.error('Error processing email event:', error);
  }
}

/**
 * Handle bounce events
 * @param {Object} event - Bounce event data
 */
async function handleBounceEvent(event) {
  console.log('Handling bounce event:', {
    email: event.email,
    reason: event.reason,
    type: event.type
  });

  // TODO: Implement bounce handling
  // - Mark user as having delivery issues
  // - Disable forwarding if hard bounce
  // - Log bounce for admin review
}

/**
 * Handle dropped email events
 * @param {Object} event - Dropped event data
 */
async function handleDroppedEvent(event) {
  console.log('Handling dropped event:', {
    email: event.email,
    reason: event.reason
  });

  // TODO: Implement dropped email handling
  // - Log dropped emails
  // - Check for policy violations
}

/**
 * Handle spam report events
 * @param {Object} event - Spam report event data
 */
async function handleSpamReportEvent(event) {
  console.log('Handling spam report event:', {
    email: event.email
  });

  // TODO: Implement spam report handling
  // - Disable notifications for user
  // - Log for admin review
}

/**
 * Handle unsubscribe events
 * @param {Object} event - Unsubscribe event data
 */
async function handleUnsubscribeEvent(event) {
  console.log('Handling unsubscribe event:', {
    email: event.email
  });

  // TODO: Implement unsubscribe handling
  // - Update user preferences
  // - Disable email notifications
}

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Webhook route error:', error);
  
  res.status(error.status || 500).json({
    error: 'Webhook processing failed',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;