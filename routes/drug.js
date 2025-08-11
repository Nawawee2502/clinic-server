const express = require('express');
const router = express.Router();

// GET all drugs with pagination and search
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { search, page = 1, limit = 50, package_code, unit_code } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                d.*,
                p.PACKAGE_NAME,
                u.UNIT_NAME
            FROM table_drug d
            LEFT JOIN table_package p ON d.PACKAGE_CODE = p.PACKAGE_CODE
            LEFT JOIN table_unit u ON d.UNIT_CODE = u.UNIT_CODE
            WHERE 1=1
        `;
        let params = [];

        if (search) {
            query += ` AND (d.GENERIC_NAME LIKE ? OR d.TRADE_NAME LIKE ? OR d.DRUG_CODE LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (package_code) {
            query += ` AND d.PACKAGE_CODE = ?`;
            params.push(package_code);
        }

        if (unit_code) {
            query += ` AND d.UNIT_CODE = ?`;
            params.push(unit_code);
        }

        query += ` ORDER BY d.GENERIC_NAME LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.execute(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM table_drug d 
            WHERE 1=1
        `;
        let countParams = [];

        if (search) {
            countQuery += ` AND (d.GENERIC_NAME LIKE ? OR d.TRADE_NAME LIKE ? OR d.DRUG_CODE LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (package_code) {
            countQuery += ` AND d.PACKAGE_CODE = ?`;
            countParams.push(package_code);
        }

        if (unit_code) {
            countQuery += ` AND d.UNIT_CODE = ?`;
            countParams.push(unit_code);
        }

        const [countResult] = await db.execute(countQuery, countParams);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching drugs:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยา',
            error: error.message
        });
    }
});

// GET drug by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute(`
            SELECT 
                d.*,
                p.PACKAGE_NAME,
                u.UNIT_NAME
            FROM table_drug d
            LEFT JOIN table_package p ON d.PACKAGE_CODE = p.PACKAGE_CODE
            LEFT JOIN table_unit u ON d.UNIT_CODE = u.UNIT_CODE
            WHERE d.DRUG_CODE = ?
        `, [code]);

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

// Search drugs by name
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT 
                d.DRUG_CODE, d.GENERIC_NAME, d.TRADE_NAME, 
                d.DOSAGE_FORM, d.STRENGTH1, d.UNIT_PRICE,
                p.PACKAGE_NAME,
                u.UNIT_NAME
            FROM table_drug d
            LEFT JOIN table_package p ON d.PACKAGE_CODE = p.PACKAGE_CODE
            LEFT JOIN table_unit u ON d.UNIT_CODE = u.UNIT_CODE
            WHERE d.GENERIC_NAME LIKE ? OR d.TRADE_NAME LIKE ? OR d.DRUG_CODE LIKE ?
            ORDER BY d.GENERIC_NAME
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

// GET drugs by indication (ข้อบ่งใช้)
router.get('/indication/:indication', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { indication } = req.params;
        const searchTerm = `%${indication}%`;

        const [rows] = await db.execute(`
            SELECT 
                d.*,
                p.PACKAGE_NAME,
                u.UNIT_NAME
            FROM table_drug d
            LEFT JOIN table_package p ON d.PACKAGE_CODE = p.PACKAGE_CODE
            LEFT JOIN table_unit u ON d.UNIT_CODE = u.UNIT_CODE
            WHERE d.INDICATION1 LIKE ?
            ORDER BY d.GENERIC_NAME
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

// POST create new drug
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
            INSERT INTO table_drug (
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
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสขนาดบรรจุหรือหน่วยนับที่ระบุ'
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

// PUT update drug
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
            UPDATE table_drug SET 
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
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสขนาดบรรจุหรือหน่วยนับที่ระบุ'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลยา',
                error: error.message
            });
        }
    }
});

// DELETE drug
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM table_drug WHERE DRUG_CODE = ?', [code]);

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
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีการใช้ยานี้ในการรักษา'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลยา',
                error: error.message
            });
        }
    }
});

// GET drug statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        // Total drugs
        const [totalCount] = await db.execute('SELECT COUNT(*) as total FROM table_drug');

        // Drugs by dosage form
        const [dosageStats] = await db.execute(`
            SELECT DOSAGE_FORM, COUNT(*) as count 
            FROM table_drug 
            WHERE DOSAGE_FORM IS NOT NULL AND DOSAGE_FORM != ''
            GROUP BY DOSAGE_FORM
            ORDER BY count DESC
        `);

        // Average price
        const [priceStats] = await db.execute(`
            SELECT 
                AVG(UNIT_PRICE) as avg_price,
                MIN(UNIT_PRICE) as min_price,
                MAX(UNIT_PRICE) as max_price
            FROM table_drug 
            WHERE UNIT_PRICE IS NOT NULL AND UNIT_PRICE > 0
        `);

        res.json({
            success: true,
            data: {
                totalDrugs: totalCount[0].total,
                byDosageForm: dosageStats,
                priceStatistics: priceStats[0],
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