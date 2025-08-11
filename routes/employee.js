const express = require('express');
const router = express.Router();

// GET all employees
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { type } = req.query;

        let query = 'SELECT * FROM employee1';
        let params = [];

        if (type) {
            query += ' WHERE EMP_TYPE = ?';
            params.push(type);
        }

        query += ' ORDER BY EMP_NAME';

        const [rows] = await db.execute(query, params);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน',
            error: error.message
        });
    }
});

// GET employee by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute('SELECT * FROM employee1 WHERE EMP_CODE = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลพนักงาน'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน',
            error: error.message
        });
    }
});

// GET employees by type (หมอ, พยาบาล, etc.)
router.get('/type/:empType', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { empType } = req.params;
        const [rows] = await db.execute(`
            SELECT * FROM employee1 
            WHERE EMP_TYPE = ? 
            ORDER BY EMP_NAME
        `, [empType]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            type: empType
        });
    } catch (error) {
        console.error('Error fetching employees by type:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงานตามประเภท',
            error: error.message
        });
    }
});

// Search employees by name
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT * FROM employee1 
            WHERE EMP_NAME LIKE ? OR EMP_CODE LIKE ?
            ORDER BY EMP_NAME
            LIMIT 50
        `, [searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching employees:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลพนักงาน',
            error: error.message
        });
    }
});

// POST create new employee
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { EMP_CODE, EMP_NAME, EMP_TYPE } = req.body;

        if (!EMP_CODE || !EMP_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อพนักงาน'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO employee1 (EMP_CODE, EMP_NAME, EMP_TYPE) VALUES (?, ?, ?)',
            [EMP_CODE, EMP_NAME, EMP_TYPE]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลพนักงานสำเร็จ',
            data: { EMP_CODE, EMP_NAME, EMP_TYPE }
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสพนักงานนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลพนักงาน',
                error: error.message
            });
        }
    }
});

// PUT update employee
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { EMP_NAME, EMP_TYPE } = req.body;

        const [result] = await db.execute(
            'UPDATE employee1 SET EMP_NAME = ?, EMP_TYPE = ? WHERE EMP_CODE = ?',
            [EMP_NAME, EMP_TYPE, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลพนักงานที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลพนักงานสำเร็จ',
            data: { EMP_CODE: code, EMP_NAME, EMP_TYPE }
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลพนักงาน',
            error: error.message
        });
    }
});

// DELETE employee
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM employee1 WHERE EMP_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลพนักงานที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลพนักงานสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีข้อมูลการรักษาที่เชื่อมโยงอยู่'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลพนักงาน',
                error: error.message
            });
        }
    }
});

// GET employee statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        // Total employees
        const [totalCount] = await db.execute('SELECT COUNT(*) as total FROM employee1');

        // Employee by type
        const [typeStats] = await db.execute(`
            SELECT EMP_TYPE, COUNT(*) as count 
            FROM employee1 
            WHERE EMP_TYPE IS NOT NULL AND EMP_TYPE != ''
            GROUP BY EMP_TYPE
            ORDER BY count DESC
        `);

        res.json({
            success: true,
            data: {
                totalEmployees: totalCount[0].total,
                byType: typeStats,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching employee statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติข้อมูลพนักงาน',
            error: error.message
        });
    }
});

module.exports = router;