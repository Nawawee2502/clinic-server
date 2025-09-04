require("dotenv").config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(morgan('combined')); // HTTP request logger

// CORS Configuration
const corsOption = {
    origin: true, // อนุญาตทุก origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control'
    ]
};

app.use(cors(corsOption));
app.options('*', cors(corsOption));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Clinic Management System API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        cors_enabled: true,
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        host: HOST
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Test endpoint working',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        headers: req.headers
    });
});

// Simple API routes (without database)
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'API endpoint working',
        available_endpoints: [
            'GET /api/health - Health check',
            'GET /api/test - Test endpoint',
            'GET /api/status - Server status'
        ]
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        server_status: 'running',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(process.uptime())} seconds`,
        node_version: process.version,
        platform: process.platform,
        memory_usage: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Initialize database and start server
async function startServer() {
    try {
        console.log('🔧 Starting simplified server...');
        
        // Comment out database connection for now to prevent crashes
        /*
        console.log('🔧 Initializing database connection...');
        const db = await require('./config/db');
        console.log('✅ Database connection established successfully');

        // Import API router
        const apiRouter = require('./routes/router');
        // Mount API routes
        app.use('/api', apiRouter);
        */
        
        console.log('⚠️  Database connection disabled for testing');
        console.log('⚠️  Full API routes disabled for testing');

        // Global error handling middleware
        app.use((err, req, res, next) => {
            console.error('Server error:', err);

            // Default error response
            res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        });

        // 404 handler
        app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not Found',
                message: `ไม่พบ API endpoint: ${req.method} ${req.originalUrl}`,
                suggestion: 'ลองตรวจสอบ URL หรือดู API documentation',
                availableEndpoints: {
                    root: '/',
                    health: '/api/health',
                    test: '/api/test',
                    status: '/api/status',
                    api: '/api'
                }
            });
        });

        // Start server
        const server = app.listen(PORT, HOST, () => {
            console.log('\n🏥 =======================================');
            console.log('🏥 CLINIC MANAGEMENT SYSTEM - SIMPLE SERVER');
            console.log('🏥 =======================================');
            console.log(`🌐 Server URL: http://${HOST}:${PORT}`);
            console.log(`🌐 Local URL: http://localhost:${PORT}`);
            console.log(`📱 API Base: http://${HOST}:${PORT}/api`);
            console.log(`🔍 Test URL: http://${HOST}:${PORT}/api/test`);
            console.log(`❤️  Health: http://${HOST}:${PORT}/api/health`);
            console.log(`📊 Status: http://${HOST}:${PORT}/api/status`);
            console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📁 Public Path: ${publicPath}`);
            console.log(`🌐 CORS Origins: All origins allowed (*)`);
            console.log('\n📋 Available Test Endpoints:');
            console.log('   🏠 Root: GET /');
            console.log('   📱 API: GET /api');
            console.log('   ❤️  Health: GET /api/health');
            console.log('   🔍 Test: GET /api/test');
            console.log('   📊 Status: GET /api/status');
            console.log('\n⚠️  Database and full API routes disabled for testing');
            console.log('🔍 Once basic server works, uncomment database code');
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

        // Graceful shutdown handling
        process.on('SIGTERM', () => {
            console.log('🔄 SIGTERM received, shutting down gracefully...');
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('🔄 SIGINT received, shutting down gracefully...');
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('💥 Failed to start server:', error.message);
        console.error('💡 Check the error details above');
        process.exit(1);
    }
}

// Start the server
startServer();

// deploy at 0409

// Export for production
module.exports = app;