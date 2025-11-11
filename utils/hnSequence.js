const dbPoolPromise = require('../config/db');

let ensurePromise = null;

const ensureIndex = async (pool, indexName, unique = false) => {
    const [rows] = await pool.query(
        `
        SELECT COUNT(1) AS count
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'patient1'
          AND INDEX_NAME = ?
        `,
        [indexName]
    );

    if (rows[0]?.count > 0) {
        return;
    }

    const indexType = unique ? 'UNIQUE ' : '';
    try {
        await pool.query(`CREATE ${indexType}INDEX ${indexName} ON patient1 (IDNO)`);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.warn('⚠️ Duplicate IDNO values detected in patient1 table. Please resolve duplicates manually to enforce uniqueness.');
            return;
        }

        if (error.code === 'ER_DUP_KEYNAME') {
            return;
        }

        throw error;
    }
};

const ensureHNSequenceInfrastructure = async () => {
    if (ensurePromise) {
        return ensurePromise;
    }

    ensurePromise = (async () => {
        const pool = await dbPoolPromise;

        await pool.query(`
            CREATE TABLE IF NOT EXISTS hn_sequence (
                year_suffix CHAR(2) NOT NULL,
                last_number INT UNSIGNED NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (year_suffix)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);

        await ensureIndex(pool, 'uniq_patient1_idno', true);
    })().catch((error) => {
        ensurePromise = null;
        throw error;
    });

    return ensurePromise;
};

const generateNextHN = async (connection) => {
    const now = new Date();
    const buddhistYear = now.getFullYear() + 543;
    const yearSuffix = buddhistYear.toString().slice(-2);

    const [result] = await connection.query(
        `
        INSERT INTO hn_sequence (year_suffix, last_number)
        VALUES (?, 1)
        ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)
        `,
        [yearSuffix]
    );

    let nextNumber;
    if (result.affectedRows === 1 && result.insertId === 0) {
        nextNumber = 1;
    } else {
        const [[lastInsertIdRow]] = await connection.query('SELECT LAST_INSERT_ID() AS nextNumber');
        nextNumber = lastInsertIdRow?.nextNumber || 1;
    }

    return `HN${yearSuffix}${nextNumber.toString().padStart(4, '0')}`;
};

module.exports = {
    ensureHNSequenceInfrastructure,
    generateNextHN
};

