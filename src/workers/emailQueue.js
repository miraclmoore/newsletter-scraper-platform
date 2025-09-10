const Queue = require('bull');
const emailProcessor = require('../services/email/processor');
const rssPoller = require('../services/rss/poller');

// Create email processing queue
const emailQueue = new Queue('email processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0,
  },
  defaultJobOptions: {
    removeOnComplete: 10, // Keep last 10 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
  },
});

// Job types
const JOB_TYPES = {
  PROCESS_EMAIL: 'process_email',
  PROCESS_WEBHOOK: 'process_webhook',
  CLEANUP_DUPLICATES: 'cleanup_duplicates',
  GENERATE_SUMMARY: 'generate_summary',
  POLL_RSS_FEEDS: 'poll_rss_feeds',
  POLL_SINGLE_RSS: 'poll_single_rss'
};

/**
 * Process email job handler
 */
emailQueue.process(JOB_TYPES.PROCESS_EMAIL, 5, async (job) => {
  const { rawEmail, forwardingAddress, jobId } = job.data;
  
  console.log(`Processing email job ${jobId || job.id}`);
  
  try {
    // Update job progress
    await job.progress(10);
    
    // Process the email
    const result = await emailProcessor.processRawEmail(rawEmail, forwardingAddress);
    
    await job.progress(80);
    
    if (!result.success) {
      throw new Error(result.error || 'Email processing failed');
    }
    
    await job.progress(100);
    
    console.log(`Email job ${jobId || job.id} completed successfully:`, {
      itemId: result.itemId,
      userId: result.userId,
      duplicate: result.duplicate
    });
    
    return result;
  } catch (error) {
    console.error(`Email job ${jobId || job.id} failed:`, error);
    throw error;
  }
});

/**
 * Process webhook job handler
 */
emailQueue.process(JOB_TYPES.PROCESS_WEBHOOK, 5, async (job) => {
  const { webhookData, jobId } = job.data;
  
  console.log(`Processing webhook job ${jobId || job.id}`);
  
  try {
    await job.progress(10);
    
    const result = await emailProcessor.processWebhookEmail(webhookData);
    
    await job.progress(80);
    
    if (!result.success) {
      throw new Error(result.error || result.reason || 'Webhook processing failed');
    }
    
    await job.progress(100);
    
    console.log(`Webhook job ${jobId || job.id} completed successfully:`, {
      itemId: result.itemId,
      userId: result.userId,
      duplicate: result.duplicate
    });
    
    return result;
  } catch (error) {
    console.error(`Webhook job ${jobId || job.id} failed:`, error);
    throw error;
  }
});

/**
 * Cleanup duplicates job handler
 */
emailQueue.process(JOB_TYPES.CLEANUP_DUPLICATES, 1, async (job) => {
  const { userId, daysOld = 30 } = job.data;
  
  console.log(`Running duplicate cleanup for user ${userId || 'all users'}`);
  
  try {
    await job.progress(10);
    
    // TODO: Implement duplicate cleanup logic
    // This would:
    // 1. Find items with same normalized_hash
    // 2. Keep the most recent one
    // 3. Delete older duplicates
    // 4. Update statistics
    
    await job.progress(50);
    
    // Placeholder implementation
    const cleaned = 0; // Number of duplicates removed
    
    await job.progress(100);
    
    console.log(`Duplicate cleanup completed: ${cleaned} duplicates removed`);
    
    return { cleaned, userId };
  } catch (error) {
    console.error('Duplicate cleanup failed:', error);
    throw error;
  }
});

/**
 * Generate summary job handler (for future AI summaries feature)
 */
emailQueue.process(JOB_TYPES.GENERATE_SUMMARY, 2, async (job) => {
  const { itemId, userId } = job.data;
  
  console.log(`Generating summary for item ${itemId}`);
  
  try {
    await job.progress(10);
    
    // TODO: Implement AI summary generation
    // This would:
    // 1. Get item content
    // 2. Call AI service (OpenAI, Anthropic, etc.)
    // 3. Store summary in summaries table
    
    await job.progress(50);
    
    // Placeholder implementation
    const summary = {
      headline: 'Summary not yet implemented',
      bullets: ['Feature coming soon'],
      model_version: 'placeholder',
      tokens_used: 0
    };
    
    await job.progress(100);
    
    console.log(`Summary generated for item ${itemId}`);
    
    return { itemId, summary };
  } catch (error) {
    console.error(`Summary generation failed for item ${itemId}:`, error);
    throw error;
  }
});

/**
 * Poll all RSS feeds job handler
 */
emailQueue.process(JOB_TYPES.POLL_RSS_FEEDS, 1, async (job) => {
  console.log('Starting RSS feeds polling job');
  
  try {
    await job.progress(10);
    
    await rssPoller.pollAllFeeds();
    
    await job.progress(100);
    
    console.log('RSS feeds polling job completed');
    
    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('RSS feeds polling job failed:', error);
    throw error;
  }
});

/**
 * Poll single RSS feed job handler
 */
emailQueue.process(JOB_TYPES.POLL_SINGLE_RSS, 3, async (job) => {
  const { sourceId } = job.data;
  
  console.log(`Polling single RSS feed: ${sourceId}`);
  
  try {
    await job.progress(10);
    
    const result = await rssPoller.pollFeed(sourceId);
    
    await job.progress(100);
    
    console.log(`Single RSS feed polling completed: ${sourceId}`);
    
    return result;
  } catch (error) {
    console.error(`Single RSS feed polling failed: ${sourceId}`, error);
    throw error;
  }
});

/**
 * Queue event handlers
 */
emailQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed successfully`);
});

emailQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed:`, error.message);
});

emailQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled and will be retried`);
});

emailQueue.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});

/**
 * Queue management functions
 */

/**
 * Add email processing job to queue
 * @param {string} rawEmail - Raw email content
 * @param {string} forwardingAddress - Forwarding address
 * @param {Object} options - Job options
 * @returns {Object} Job instance
 */
async function addEmailJob(rawEmail, forwardingAddress, options = {}) {
  const jobData = {
    rawEmail,
    forwardingAddress,
    jobId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  const jobOptions = {
    priority: options.priority || 0,
    delay: options.delay || 0,
    attempts: options.attempts || 3,
    ...options
  };
  
  return await emailQueue.add(JOB_TYPES.PROCESS_EMAIL, jobData, jobOptions);
}

/**
 * Add webhook processing job to queue
 * @param {Object} webhookData - Webhook data
 * @param {Object} options - Job options
 * @returns {Object} Job instance
 */
async function addWebhookJob(webhookData, options = {}) {
  const jobData = {
    webhookData,
    jobId: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  const jobOptions = {
    priority: options.priority || 10, // Higher priority for webhooks
    delay: options.delay || 0,
    attempts: options.attempts || 3,
    ...options
  };
  
  return await emailQueue.add(JOB_TYPES.PROCESS_WEBHOOK, jobData, jobOptions);
}

/**
 * Add duplicate cleanup job to queue
 * @param {string} userId - User ID (optional, cleans all users if not provided)
 * @param {Object} options - Job options
 * @returns {Object} Job instance
 */
async function addCleanupJob(userId = null, options = {}) {
  const jobData = {
    userId,
    daysOld: options.daysOld || 30
  };
  
  const jobOptions = {
    priority: options.priority || -10, // Lower priority for cleanup
    delay: options.delay || 0,
    attempts: options.attempts || 1, // Don't retry cleanup jobs
    ...options
  };
  
  return await emailQueue.add(JOB_TYPES.CLEANUP_DUPLICATES, jobData, jobOptions);
}

/**
 * Add summary generation job to queue
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @param {Object} options - Job options
 * @returns {Object} Job instance
 */
async function addSummaryJob(itemId, userId, options = {}) {
  const jobData = {
    itemId,
    userId
  };
  
  const jobOptions = {
    priority: options.priority || 5,
    delay: options.delay || 0,
    attempts: options.attempts || 2,
    ...options
  };
  
  return await emailQueue.add(JOB_TYPES.GENERATE_SUMMARY, jobData, jobOptions);
}

/**
 * Add RSS polling job to queue
 * @param {Object} options - Job options
 * @returns {Object} Job instance
 */
async function addRSSPollingJob(options = {}) {
  const jobData = {
    timestamp: new Date().toISOString()
  };
  
  const jobOptions = {
    priority: options.priority || 0,
    delay: options.delay || 0,
    attempts: options.attempts || 2,
    ...options
  };
  
  return await emailQueue.add(JOB_TYPES.POLL_RSS_FEEDS, jobData, jobOptions);
}

/**
 * Add single RSS feed polling job to queue
 * @param {string} sourceId - RSS source ID
 * @param {Object} options - Job options
 * @returns {Object} Job instance
 */
async function addSingleRSSPollingJob(sourceId, options = {}) {
  const jobData = {
    sourceId
  };
  
  const jobOptions = {
    priority: options.priority || 5,
    delay: options.delay || 0,
    attempts: options.attempts || 3,
    ...options
  };
  
  return await emailQueue.add(JOB_TYPES.POLL_SINGLE_RSS, jobData, jobOptions);
}

/**
 * Schedule recurring RSS polling job
 * @param {string} cronPattern - Cron pattern (default: every 30 minutes)
 * @returns {Object} Scheduled job
 */
async function scheduleRSSPolling(cronPattern = '*/30 * * * *') {
  // Remove existing recurring RSS polling jobs
  const repeatableJobs = await emailQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === JOB_TYPES.POLL_RSS_FEEDS) {
      await emailQueue.removeRepeatableByKey(job.key);
    }
  }
  
  // Add new recurring job
  return await emailQueue.add(
    JOB_TYPES.POLL_RSS_FEEDS,
    { scheduled: true },
    {
      repeat: { cron: cronPattern },
      removeOnComplete: 5,
      removeOnFail: 10
    }
  );
}

/**
 * Get queue statistics
 * @returns {Object} Queue stats
 */
async function getQueueStats() {
  const waiting = await emailQueue.getWaiting();
  const active = await emailQueue.getActive();
  const completed = await emailQueue.getCompleted();
  const failed = await emailQueue.getFailed();
  const delayed = await emailQueue.getDelayed();
  
  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    total: waiting.length + active.length + completed.length + failed.length + delayed.length
  };
}

/**
 * Clean old jobs from queue
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {Promise} Cleanup promise
 */
async function cleanOldJobs(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
  return await emailQueue.clean(maxAge, 'completed');
}

/**
 * Pause queue processing
 */
async function pauseQueue() {
  return await emailQueue.pause();
}

/**
 * Resume queue processing
 */
async function resumeQueue() {
  return await emailQueue.resume();
}

/**
 * Get queue health status
 * @returns {Object} Health status
 */
async function getQueueHealth() {
  try {
    const stats = await getQueueStats();
    const isHealthy = stats.failed < 10 && stats.active < 50;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  emailQueue,
  JOB_TYPES,
  addEmailJob,
  addWebhookJob,
  addCleanupJob,
  addSummaryJob,
  addRSSPollingJob,
  addSingleRSSPollingJob,
  scheduleRSSPolling,
  getQueueStats,
  cleanOldJobs,
  pauseQueue,
  resumeQueue,
  getQueueHealth
};