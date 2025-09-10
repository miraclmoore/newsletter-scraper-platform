const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import middleware
const { generalLimiter } = require('./middleware/rateLimiting');

// Import routes
const authRoutes = require('./routes/auth-supabase');
const emailWebhookRoutes = require('./routes/webhooks/email');
const sourcesRoutes = require('./routes/sources');
const itemsRoutes = require('./routes/items');
const exportsRoutes = require('./routes/exports');
const usersRoutes = require('./routes/users');

// Import Supabase configuration
const { supabaseAdmin } = require('./config/supabase');

// Import RSS polling service
const { rssPoller } = require('./services/rss');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve static files
app.use(express.static('public'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks/email', emailWebhookRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/users', usersRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Initialize Supabase connection and start server
async function startServer() {
  try {
    // Test Supabase connection
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      console.log('💡 Please check your Supabase configuration in .env file');
    } else {
      console.log('✅ Supabase connection established successfully');
    }

    // Start RSS polling service if enabled
    if (process.env.RSS_POLLING_ENABLED !== 'false') {
      try {
        await rssPoller.startPolling();
        console.log('📡 RSS polling service started');
      } catch (error) {
        console.error('❌ Failed to start RSS polling service:', error.message);
      }
    } else {
      console.log('📡 RSS polling service disabled');
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Newsletter Scraper API server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ Database: Supabase PostgreSQL`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📖 API Documentation: http://localhost:${PORT}/api`);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  try {
    rssPoller.stopPolling();
    console.log('📡 RSS polling service stopped');
  } catch (error) {
    console.error('❌ Error stopping RSS polling service:', error.message);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  try {
    rssPoller.stopPolling();
    console.log('📡 RSS polling service stopped');
  } catch (error) {
    console.error('❌ Error stopping RSS polling service:', error.message);
  }
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;