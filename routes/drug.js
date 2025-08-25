const express = require('express');
const router = express.Router();

// ✅ Working GET all drugs - แก้ไข MySQL parameter issue
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { search, page = 1, limit = 50 } = req.query;

        // ✅ แปลงเป็น integer และ validate
        const limitInt = Math.max(1, Math.min(100, parseInt(limit) || 50));
        const pageInt = Math.max(1, parseInt(page) || 1);
        const offset = (pageInt - 1) * limitInt;

        let query = `SELECT * FROM TABLE_DRUG WHERE 1=1`;
        let params = [];

        if (search) {
            query += ` AND (GENERIC_NAME LIKE ? OR TRADE_NAME LIKE ? OR DRUG_CODE LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // ✅ แก้ไข: ใช้ string interpolation แทน parameter binding สำหรับ LIMIT/OFFSET
        query += ` ORDER BY GENERIC_NAME LIMIT ${limitInt} OFFSET ${offset}`;

        console.log('🔍 Executing query:', query);
        console.log('📝 Parameters:', params);

        const [rows] = await db.execute(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM TABLE_DRUG WHERE 1=1`;
        let countParams = [];

        if (search) {
            countQuery += ` AND (GENERIC_NAME LIKE ? OR TRADE_NAME LIKE ? OR DRUG_CODE LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        const [countResult] = await db.execute(countQuery, countParams);

        console.log(`✅ Found ${rows.length} drugs, total: ${countResult[0].total}`);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: pageInt,
                limit: limitInt,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limitInt)
            }
        });
    } catch (error) {
        console.error('❌ Error fetching drugs:', error);

        // ✅ ถ้า TABLE_DRUG ไม่มี ให้ส่งข้อมูลจำลอง
        if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes('TABLE_DRUG')) {
            console.log('📦 TABLE_DRUG not found, returning mock data');

            const mockDrugs = [
                { DRUG_CODE: 'MED001', GENERIC_NAME: 'Paracetamol 500mg', TRADE_NAME: 'Tylenol', UNIT_CODE: 'TAB' },
                { DRUG_CODE: 'MED002', GENERIC_NAME: 'Amoxicillin 250mg', TRADE_NAME: 'Amoxil', UNIT_CODE: 'CAP' },
                { DRUG_CODE: 'MED003', GENERIC_NAME: 'Omeprazole 20mg', TRADE_NAME: 'Losec', UNIT_CODE: 'CAP' },
                { DRUG_CODE: 'MED004', GENERIC_NAME: 'Salbutamol 100mcg', TRADE_NAME: 'Ventolin', UNIT_CODE: 'SPRAY' },
                { DRUG_CODE: 'MED005', GENERIC_NAME: 'Metformin 500mg', TRADE_NAME: 'Glucophage', UNIT_CODE: 'TAB' },
                { DRUG_CODE: 'MED006', GENERIC_NAME: 'Ibuprofen 400mg', TRADE_NAME: 'Brufen', UNIT_CODE: 'TAB' },
                { DRUG_CODE: 'MED007', GENERIC_NAME: 'Cetirizine 10mg', TRADE_NAME: 'Zyrtec', UNIT_CODE: 'TAB' },
                { DRUG_CODE: 'MED008', GENERIC_NAME: 'Loratadine 10mg', TRADE_NAME: 'Claritin', UNIT_CODE: 'TAB' },
                { DRUG_CODE: 'MED009', GENERIC_NAME: 'Aspirin 100mg', TRADE_NAME: 'Cardiprin', UNIT_CODE: 'TAB' },
                { DRUG_CODE: 'MED010', GENERIC_NAME: 'Simvastatin 20mg', TRADE_NAME: 'Zocor', UNIT_CODE: 'TAB' }
            ];

            return res.json({
                success: true,
                data: mockDrugs,
                pagination: {
                    page: 1,
                    limit: 50,
                    total: mockDrugs.length,
                    totalPages: 1
                },
                note: 'Using mock data - TABLE_DRUG not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยา',
            error: error.message,
            code: error.code
        });
    }
});

// ✅ GET drug by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(`SELECT * FROM TABLE_DRUG WHERE DRUG_CODE = ?`, [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยา'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยา',
            error: error.message
        });
    }
});

// ✅ Search drugs by name
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT DRUG_CODE, GENERIC_NAME, TRADE_NAME, UNIT_CODE
            FROM TABLE_DRUG 
            WHERE GENERIC_NAME LIKE ? OR TRADE_NAME LIKE ? OR DRUG_CODE LIKE ?
            ORDER BY GENERIC_NAME
            LIMIT 100
        `, [searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching drugs:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลยา',
            error: error.message
        });
    }
});

// ✅ GET drugs by indication
router.get('/indication/:indication', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { indication } = req.params;
        const searchTerm = `%${indication}%`;

        const [rows] = await db.execute(`
            SELECT * FROM TABLE_DRUG 
            WHERE INDICATION1 LIKE ?
            ORDER BY GENERIC_NAME
        `, [searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            indication: indication
        });
    } catch (error) {
        console.error('Error fetching drugs by indication:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยาตามข้อบ่งใช้',
            error: error.message
        });
    }
});

// ✅ POST create new drug
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const {
            DRUG_CODE, GENERIC_NAME, TRADE_NAME, DOSAGE_FORM, STRENGTH1,
            PACKAGE_CODE, ROUTE_ADMIN, DOSE1, INDICATION1, CONTRAINDICATION1,
            SIDE_EFFECTS, PRECAUTIONS1, NATION_LIST_CODE, NARCOTICS1,
            UNIT_CODE, UNIT_PRICE
        } = req.body;

        if (!DRUG_CODE || !GENERIC_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสยาและชื่อสามัญ'
            });
        }

        const [result] = await db.execute(`
            INSERT INTO TABLE_DRUG (
                DRUG_CODE, GENERIC_NAME, TRADE_NAME, DOSAGE_FORM, STRENGTH1,
                PACKAGE_CODE, ROUTE_ADMIN, DOSE1, INDICATION1, CONTRAINDICATION1,
                SIDE_EFFECTS, PRECAUTIONS1, NATION_LIST_CODE, NARCOTICS1,
                UNIT_CODE, UNIT_PRICE
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            DRUG_CODE, GENERIC_NAME, TRADE_NAME, DOSAGE_FORM, STRENGTH1,
            PACKAGE_CODE, ROUTE_ADMIN, DOSE1, INDICATION1, CONTRAINDICATION1,
            SIDE_EFFECTS, PRECAUTIONS1, NATION_LIST_CODE, NARCOTICS1,
            UNIT_CODE, UNIT_PRICE
        ]);

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลยาสำเร็จ',
            data: {
                DRUG_CODE,
                GENERIC_NAME,
                TRADE_NAME
            }
        });
    } catch (error) {
        console.error('Error creating drug:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสยานี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลยา',
                error: error.message
            });
        }
    }
});

// ✅ PUT update drug
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const {
            GENERIC_NAME, TRADE_NAME, DOSAGE_FORM, STRENGTH1,
            PACKAGE_CODE, ROUTE_ADMIN, DOSE1, INDICATION1, CONTRAINDICATION1,
            SIDE_EFFECTS, PRECAUTIONS1, NATION_LIST_CODE, NARCOTICS1,
            UNIT_CODE, UNIT_PRICE
        } = req.body;

        const [result] = await db.execute(`
            UPDATE TABLE_DRUG SET 
                GENERIC_NAME = ?, TRADE_NAME = ?, DOSAGE_FORM = ?, STRENGTH1 = ?,
                PACKAGE_CODE = ?, ROUTE_ADMIN = ?, DOSE1 = ?, INDICATION1 = ?, 
                CONTRAINDICATION1 = ?, SIDE_EFFECTS = ?, PRECAUTIONS1 = ?, 
                NATION_LIST_CODE = ?, NARCOTICS1 = ?, UNIT_CODE = ?, UNIT_PRICE = ?
            WHERE DRUG_CODE = ?
        `, [
            GENERIC_NAME, TRADE_NAME, DOSAGE_FORM, STRENGTH1,
            PACKAGE_CODE, ROUTE_ADMIN, DOSE1, INDICATION1, CONTRAINDICATION1,
            SIDE_EFFECTS, PRECAUTIONS1, NATION_LIST_CODE, NARCOTICS1,
            UNIT_CODE, UNIT_PRICE, code
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยาที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลยาสำเร็จ',
            data: {
                DRUG_CODE: code,
                GENERIC_NAME,
                TRADE_NAME
            }
        });
    } catch (error) {
        console.error('Error updating drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลยา',
            error: error.message
        });
    }
});

// ✅ DELETE drug
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM TABLE_DRUG WHERE DRUG_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยาที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลยาสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลยา',
            error: error.message
        });
    }
});

// ✅ GET drug statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        // Total drugs
        const [totalCount] = await db.execute('SELECT COUNT(*) as total FROM TABLE_DRUG');

        // Drugs by dosage form
        const [dosageStats] = await db.execute(`
            SELECT DOSAGE_FORM, COUNT(*) as count 
            FROM TABLE_DRUG 
            WHERE DOSAGE_FORM IS NOT NULL AND DOSAGE_FORM != ''
            GROUP BY DOSAGE_FORM
            ORDER BY count DESC
        `);

        res.json({
            success: true,
            data: {
                totalDrugs: totalCount[0].total,
                byDosageForm: dosageStats,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching drug statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติข้อมูลยา',
            error: error.message
        });
    }
});

module.exports = router;