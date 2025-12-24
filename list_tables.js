
const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'clinic_db', // Guessing the local DB name based on previous attempts
    port: 3306
};

async function listTables() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SHOW TABLES');
        console.log('Tables:', rows.map(r => Object.values(r)[0]));
        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

listTables();
