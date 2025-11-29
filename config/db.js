const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'goodappdev.com',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'goodappd_clinic',
  password: process.env.DB_PASSWORD || '0850789392',
  database: process.env.DB_NAME || 'goodapp_clinic',
  waitForConnections: true,
  connectionLimit: 20, // เพิ่มจาก 10 เป็น 20
  queueLimit: 10, // เพิ่ม queue limit เพื่อรองรับ request ที่รอ
  acquireTimeout: 60000, // 60 seconds timeout สำหรับการ acquire connection
  timeout: 60000, // 60 seconds timeout สำหรับ query
  charset: 'utf8mb4',
  ssl: false   // 👈 ปิด SSL (เพราะ MySQL บน Plesk ไม่ได้เปิด SSL)
});

// เพิ่ม error handling สำหรับ connection pool
pool.on('connection', (connection) => {
  console.log('✅ New connection established as id ' + connection.threadId);
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('⚠️ Database connection lost. Attempting to reconnect...');
  } else {
    throw err;
  }
});

module.exports = pool.promise();
