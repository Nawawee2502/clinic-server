require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require('path');
const fs = require('fs');

// Import routes
const apiRouter = require('./routes/router');

// Configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// CORS Configuration
const corsOption = {
  origin: [
    "http://localhost:3000",
    "http://192.168.1.100:3000",
    "http://127.0.0.1:3000"
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOption));

// Static files setup
const publicPath = path.join(__dirname, 'public');
const uploadsPath = path.join(__dirname, 'public', 'uploads');

// Create directories if they don't exist
[publicPath, uploadsPath].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Serve static files
app.use('/public', express.static(publicPath, {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Debug middleware for static files
app.use('/public', (req, res, next) => {
  const requestedPath = path.join(publicPath, req.path);
  console.log('Static file request:', {
    path: req.path,
    fullPath: requestedPath,
    exists: fs.existsSync(requestedPath)
  });
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    result: true,
    message: 'Clinic Management System API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      test: `http://${req.get('host')}/api/test`,
      health: `http://${req.get('host')}/api/health`,
      docs: `http://${req.get('host')}/api/docs`
    }
  });
});

// API Routes
app.use("/api", apiRouter);

// Database connection
console.log('🔄 Initializing database connection...');
const db = require("./models/mainModel");

db.sequelize
  .authenticate()
  .then(() => {
    console.log('✅ Database connection established successfully');
    return db.sequelize.sync({
      alter: false, // Set to true in development to auto-update tables
      force: false  // Set to true to drop and recreate tables (DANGER!)
    });
  })
  .then(() => {
    console.log('✅ Database tables synchronized');
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    console.error('💡 Please check your database configuration in .env file');
    process.exit(1);
  });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  // Handle specific error types
  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      result: false,
      error: 'Database connection error',
      message: 'Unable to connect to database'
    });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      result: false,
      error: 'Validation error',
      message: err.message,
      details: err.errors
    });
  }

  // Default error response
  res.status(500).json({
    result: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    result: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: {
      api: '/api',
      test: '/api/test',
      health: '/api/health',
      docs: '/api/docs'
    }
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  db.sequelize.close().then(() => {
    console.log('✅ Database connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  db.sequelize.close().then(() => {
    console.log('✅ Database connection closed');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log('\n🏥 =======================================');
  console.log('🏥 CLINIC MANAGEMENT SYSTEM - SERVER');
  console.log('🏥 =======================================');
  console.log(`🌐 Server URL: http://${HOST}:${PORT}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`🌐 LAN URL: http://192.168.1.100:${PORT}`);
  console.log(`📱 API Base: http://${HOST}:${PORT}/api`);
  console.log(`🔍 Test URL: http://${HOST}:${PORT}/api/test`);
  console.log(`❤️  Health: http://${HOST}:${PORT}/api/health`);
  console.log(`📚 Docs: http://${HOST}:${PORT}/api/docs`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Public Path: ${publicPath}`);
  console.log('🏥 =======================================\n');
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error('💡 Try using a different port or stop the existing server');
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

module.exports = app;