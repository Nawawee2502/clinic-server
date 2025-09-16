// const mysql = require('mysql2');
// require('dotenv').config();

// // Database configurations to try
// const dbConfigs = [
//   {
//     name: 'MAMP',
//     host: 'localhost',
//     port: 8889,
//     user: 'root',
//     password: 'root',
//   },
//   {
//     name: 'XAMPP',
//     host: 'localhost',
//     port: 3306,
//     user: 'root',
//     password: '',
//   },
//   {
//     name: 'Default MySQL',
//     host: 'localhost',
//     port: 3306,
//     user: 'root',
//     password: 'root',
//   },
//   {
//     name: 'Environment Variables',
//     host: process.env.DB_HOST || 'localhost',
//     port: parseInt(process.env.DB_PORT) || 3306,
//     user: process.env.DB_USER || 'root',
//     password: process.env.DB_PASSWORD || '',
//   }
// ];

// let pool = null;

// // Function to test connection
// function testConnection(config) {
//   return new Promise((resolve, reject) => {
//     const connection = mysql.createConnection({
//       host: config.host,
//       port: config.port,
//       user: config.user,
//       password: config.password,
//       database: process.env.DB_NAME || 'ga_clinic',
//       charset: 'utf8mb4',
//       connectTimeout: 5000
//     });

//     connection.connect((err) => {
//       if (err) {
//         connection.destroy();
//         reject(err);
//       } else {
//         connection.end();
//         resolve(config);
//       }
//     });
//   });
// }

// // Initialize connection pool
// async function initializeDatabase() {
//   console.log('🔍 Searching for MySQL connection...\n');

//   for (const config of dbConfigs) {
//     try {
//       console.log(`⚡ Trying ${config.name} configuration...`);
//       console.log(`   📍 Host: ${config.host}:${config.port}`);
//       console.log(`   👤 User: ${config.user}`);
//       console.log(`   🔐 Password: ${config.password ? '***' : '(empty)'}`);

//       await testConnection(config);

//       // Create pool with successful config
//       pool = mysql.createPool({
//         host: config.host,
//         port: config.port,
//         user: config.user,
//         password: config.password,
//         database: process.env.DB_NAME || 'ga_clinic',
//         waitForConnections: true,
//         connectionLimit: 10,
//         queueLimit: 0,
//         charset: 'utf8mb4'
//       });

//       console.log(`✅ Successfully connected with ${config.name}!\n`);
//       break;

//     } catch (error) {
//       console.log(`❌ ${config.name} failed: ${error.code || error.message}`);
//       console.log('');
//     }
//   }

//   if (!pool) {
//     console.error('🚨 Could not connect to MySQL with any configuration!\n');
//     console.error('📋 Troubleshooting steps:');
//     console.error('   1. ✓ Check if MySQL server is running');
//     console.error('   2. ✓ Verify the correct port (3306 or 8889)');
//     console.error('   3. ✓ Check username and password');
//     console.error('   4. ✓ Ensure database "ga_clinic" exists');
//     console.error('   5. ✓ Try starting MySQL manually:\n');
//     console.error('      MAMP: Open MAMP app → Start Servers');
//     console.error('      XAMPP: Open XAMPP → Start MySQL');
//     console.error('      Homebrew: brew services start mysql');
//     console.error('      Manual: sudo /usr/local/mysql/support-files/mysql.server start\n');

//     process.exit(1);
//   }

//   return pool.promise();
// }

// // Export a promise that resolves to the pool
// module.exports = initializeDatabase();

const mysql = require('mysql2');
require('dotenv').config();

// Parse DATABASE_URL if provided
function parseDatabaseUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 3306,
      user: urlObj.username,
      password: urlObj.password,
      database: urlObj.pathname.slice(1), // Remove leading '/'
    };
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error.message);
    return null;
  }
}

// Database configurations to try
const dbConfigs = [
  // Railway configuration (first priority)
  ...(process.env.DATABASE_URL ? [{
    name: 'Railway (DATABASE_URL)',
    ...parseDatabaseUrl(process.env.DATABASE_URL),
    ssl: {
      rejectUnauthorized: false
    },
    acquireTimeout: 60000,
    timeout: 60000
  }] : []),
  
  // Railway configuration (environment variables)
  ...(process.env.DB_HOST && process.env.DB_HOST.includes('railway') ? [{
    name: 'Railway (Environment Variables)',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 10961,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'railway',
    ssl: {
      rejectUnauthorized: false
    },
    acquireTimeout: 60000,
    timeout: 60000
  }] : []),
  
  // Local configurations
  {
    name: 'MAMP',
    host: 'localhost',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'ga_clinic'
  },
  {
    name: 'XAMPP',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'ga_clinic'
  },
  {
    name: 'Default MySQL',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'ga_clinic'
  },
  {
    name: 'Environment Variables (Local)',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ga_clinic'
  }
];

let pool = null;

// Function to test connection
function testConnection(config) {
  return new Promise((resolve, reject) => {
    if (!config.host) {
      reject(new Error('Invalid configuration'));
      return;
    }

    const connection = mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: 'utf8mb4',
      connectTimeout: 10000,
      ssl: config.ssl || false
    });

    connection.connect((err) => {
      if (err) {
        connection.destroy();
        reject(err);
      } else {
        connection.end();
        resolve(config);
      }
    });
  });
}

// Initialize connection pool
async function initializeDatabase() {
  console.log('🔍 Searching for MySQL connection...\n');

  for (const config of dbConfigs) {
    if (!config || !config.host) continue;

    try {
      console.log(`⚡ Trying ${config.name} configuration...`);
      console.log(`   📍 Host: ${config.host}:${config.port}`);
      console.log(`   👤 User: ${config.user}`);
      console.log(`   🔐 Password: ${config.password ? '***' : '(empty)'}`);
      console.log(`   🗄️  Database: ${config.database}`);

      await testConnection(config);

      // Create pool with successful config
      pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
        ssl: config.ssl || false,
        acquireTimeout: config.acquireTimeout || 60000,
        timeout: config.timeout || 60000
      });

      console.log(`✅ Successfully connected with ${config.name}!\n`);
      break;

    } catch (error) {
      console.log(`❌ ${config.name} failed: ${error.code || error.message}`);
      console.log('');
    }
  }

  if (!pool) {
    console.error('🚨 Could not connect to MySQL with any configuration!\n');
    console.error('📋 Troubleshooting steps:');
    console.error('   1. ✓ Check if Railway MySQL service is running');
    console.error('   2. ✓ Verify Railway connection credentials in .env');
    console.error('   3. ✓ Check DATABASE_URL format');
    console.error('   4. ✓ Ensure Railway database is accessible');
    console.error('   5. ✓ Check network connectivity\n');

    process.exit(1);
  }

  return pool.promise();
}

// Export a promise that resolves to the pool
module.exports = initializeDatabase();