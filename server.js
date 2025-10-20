require("dotenv").config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(morgan('combined')); // HTTP request logger

// ========= CORS Configuration =========
// แก้ไขให้รองรับทุก origin และ credentials
const corsOption = {
    origin: function (origin, callback) {
        // อนุญาตทุก origin (รวม localhost และ production)
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// ใช้ CORS middleware ก่อน routes อื่นๆ
app.use(cors(corsOption));

// Handle preflight requests สำหรับทุก route
app.options('*', cors(corsOption));

// เพิ่ม manual CORS headers เพื่อความแน่ใจ
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    res.header('Access-Control-Allow-Credentials', 'true');

    // ถ้าเป็น preflight request ให้ตอบกลับทันที
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json({ limit: '50mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded bodies

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
        allowed_origins: 'All origins allowed',
        endpoints: {
            // Location APIs
            provinces: '/api/provinces',
            amphers: '/api/amphers',
            tumbols: '/api/tumbols',

            // Patient API
            patients: '/api/patients',

            // Medical Staff & Resources
            employees: '/api/employees',
            drugs: '/api/drugs',
            procedures: '/api/procedures',

            // Medical Coding
            diagnosis: '/api/diagnosis',
            icd10: '/api/icd10',

            // Laboratory & Radiology
            lab: '/api/lab',
            radiological: '/api/radiological',
            ix: '/api/ix',

            // Treatment (Main)
            treatments: '/api/treatments',

            // Appointment & Queue
            appointments: '/api/appointments',
            queue: '/api/queue',

            // Utilities
            units: '/api/units',
            packages: '/api/packages',

            // Financial
            bank: '/api/bank',
            bookBank: '/api/book-bank',
            typePay: '/api/typepay',
            typeIncome: '/api/typeincome',
            supplier: '/api/supplier',
            pay1: '/api/pay1',
            income1: '/api/income1',

            // ✅ Inventory Management
            balMonthDrug: '/api/bal_month_drug',
            borrow1: '/api/borrow1',
            checkStock: '/api/check_stock',
            receipt1: '/api/receipt1',
            return1: '/api/return1',

            // System
            health: '/api/health',
            test: '/api/test',
            docs: '/api/docs'
        }
    });
});

// Initialize database and start server
async function startServer() {
    try {
        // Wait for database connection
        console.log('🔧 Initializing database connection...');
        const db = await require('./config/db');
        console.log('✅ Database connection established successfully');

        // Import API router
        const apiRouter = require('./routes/router');

        const userRoutes = require('./routes/users');
        app.use('/api/users', userRoutes);

        // Mount API routes
        app.use('/api', apiRouter);

        // Global error handling middleware
        app.use((err, req, res, next) => {
            console.error('Server error:', err);

            // Handle specific database errors
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    error: 'Duplicate Entry',
                    message: 'ข้อมูลที่ส่งมามีอยู่แล้วในระบบ'
                });
            }

            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({
                    success: false,
                    error: 'Foreign Key Constraint',
                    message: 'ไม่พบข้อมูลอ้างอิงที่ระบุ'
                });
            }

            if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                return res.status(409).json({
                    success: false,
                    error: 'Referenced Data',
                    message: 'ไม่สามารถลบได้เนื่องจากมีข้อมูลอื่นที่เชื่อมโยงอยู่'
                });
            }

            // Handle MySQL connection errors
            if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR') {
                return res.status(503).json({
                    success: false,
                    error: 'Database Connection Error',
                    message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'
                });
            }

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
                suggestion: 'ลองตรวจสอบ URL หรือดู API documentation ที่ /api/docs',
                availableEndpoints: {
                    root: '/',
                    health: '/api/health',
                    test: '/api/test',
                    docs: '/api/docs'
                }
            });
        });

        // Start server
        const server = app.listen(PORT, HOST, () => {
            console.log('\n🏥 =======================================');
            console.log('🏥 CLINIC MANAGEMENT SYSTEM - SERVER');
            console.log('🏥 =======================================');
            console.log(`🌐 Server URL: http://${HOST}:${PORT}`);
            console.log(`🌐 Local URL: http://localhost:${PORT}`);
            console.log(`📱 API Base: http://${HOST}:${PORT}/api`);
            console.log(`🔍 Test URL: http://${HOST}:${PORT}/api/test`);
            console.log(`❤️  Health: http://${HOST}:${PORT}/api/health`);
            console.log(`📚 Docs: http://${HOST}:${PORT}/api/docs`);
            console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📁 Public Path: ${publicPath}`);
            console.log(`🌐 CORS: Enabled for ALL origins with credentials`);
            console.log('\n📋 Available API Endpoints:');
            console.log('   📍 Location APIs:');
            console.log('      GET  /api/provinces');
            console.log('      GET  /api/amphers');
            console.log('      GET  /api/tumbols');
            console.log('\n   👥 Patient & Staff APIs:');
            console.log('      GET  /api/patients');
            console.log('      GET  /api/employees');
            console.log('\n   💊 Medical Resources APIs:');
            console.log('      GET  /api/drugs');
            console.log('      GET  /api/procedures');
            console.log('      GET  /api/diagnosis');
            console.log('      GET  /api/icd10');
            console.log('\n   🔬 Laboratory & Testing APIs:');
            console.log('      GET  /api/lab');
            console.log('      GET  /api/radiological');
            console.log('      GET  /api/ix');
            console.log('\n   🏥 Treatment & Appointment APIs:');
            console.log('      GET  /api/treatments');
            console.log('      GET  /api/appointments');
            console.log('      GET  /api/queue');
            console.log('\n   💰 Financial APIs:');
            console.log('      GET  /api/bank');
            console.log('      GET  /api/book-bank');
            console.log('      GET  /api/typepay');
            console.log('      GET  /api/typeincome');
            console.log('      GET  /api/supplier');
            console.log('      POST /api/pay1');
            console.log('      POST /api/income1');
            console.log('\n   📦 Inventory Management APIs:');
            console.log('      GET  /api/bal_month_drug');
            console.log('      GET  /api/borrow1');
            console.log('      GET  /api/check_stock');
            console.log('      GET  /api/receipt1');
            console.log('      GET  /api/return1');
            console.log('\n   ⚙️  Utility APIs:');
            console.log('      GET  /api/units');
            console.log('      GET  /api/packages');
            console.log('\n🌐 CORS enabled for all origins');
            console.log('🔍 Request logging enabled');
            console.log('📚 Full API documentation available at /api/docs');
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
        console.error('💡 Please check your database configuration and connection');
        process.exit(1);
    }
}

// Start the server
startServer();

// Export for Vercel
if (process.env.NODE_ENV === 'production') {
    module.exports = app;
} else {
    module.exports = app;
}