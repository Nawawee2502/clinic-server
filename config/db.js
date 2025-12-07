const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'goodappdev.com',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'goodappd_clinic',
  password: process.env.DB_PASSWORD || '0850789392',
  database: process.env.DB_NAME || 'goodapp_clinic',
  waitForConnections: true,
  connectionLimit: 50, // ✅ เพิ่มเป็น 50 เพื่อรองรับ concurrent requests
  queueLimit: 0, // ✅ 0 = unlimited queue (ไม่ reject request)
  acquireTimeout: 60000, // ✅ 60 วินาที (เพราะ initial connection อาจช้า)
  timeout: 60000, // ✅ 60 วินาที (เพราะ query อาจช้า)
  enableKeepAlive: true, // ✅ เปิด keep-alive
  keepAliveInitialDelay: 0, // ✅ keep-alive ทันที
  charset: 'utf8mb4',
  ssl: false   // 👈 ปิด SSL (เพราะ MySQL บน Plesk ไม่ได้เปิด SSL)
});

// เพิ่ม error handling สำหรับ connection pool
pool.on('connection', (connection) => {
  console.log(`✅ New connection established as id ${connection.threadId}`);
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('⚠️ Database connection lost. Attempting to reconnect...');
  } else {
    throw err;
  }
});

// ✅ เพิ่ม logging เพื่อตรวจสอบ connection pool status
setInterval(() => {
  const poolStatus = {
    totalConnections: pool._allConnections?.length || 0,
    freeConnections: pool._freeConnections?.length || 0,
    queuedRequests: pool._connectionQueue?.length || 0
  };
  if (poolStatus.totalConnections > 0 || poolStatus.queuedRequests > 0) {
    console.log('📊 Pool status:', poolStatus);
  }
}, 10000); // Log ทุก 10 วินาที

module.exports = pool.promise();
