const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'goodappdev.com',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'goodappd_clinic',
  password: process.env.DB_PASSWORD || '0850789392',
  database: process.env.DB_NAME || 'goodapp_clinic',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  ssl: false   // 👈 ปิด SSL (เพราะ MySQL บน Plesk ไม่ได้เปิด SSL)
});

module.exports = pool.promise();
