const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'ไม่พบ Token กรุณาเข้าสู่ระบบ'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Token ไม่ถูกต้องหรือหมดอายุ',
                expired: true
            });
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็นผู้ดูแลระบบ)'
        });
    }
    next();
};

router.use(authenticateToken);
router.use(requireAdmin);

const generateRoleCode = async (db) => {
    const prefix = 'ROLE';
    const numberLength = 4;

    const [rows] = await db.execute(
        `SELECT ROLE_CODE FROM ROLE WHERE ROLE_CODE LIKE ? ORDER BY ROLE_CODE DESC LIMIT 1`,
        [`${prefix}%`]
    );

    let nextNumber = 1;

    if (rows.length > 0) {
        const lastCode = rows[0].ROLE_CODE;
        const numericPart = parseInt(lastCode.replace(prefix, ''), 10);
        if (!Number.isNaN(numericPart)) {
            nextNumber = numericPart + 1;
        }
    }

    return `${prefix}${String(nextNumber).padStart(numberLength, '0')}`;
};

// GET all roles
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT 
                ROLE_CODE AS roleCode,
                ROLE_NAME AS roleName,
                CREATED_AT AS createdAt,
                UPDATED_AT AS updatedAt
            FROM ROLE
            ORDER BY ROLE_CODE ASC
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์',
            error: error.message
        });
    }
});

// GET role by code
router.get('/:roleCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { roleCode } = req.params;

        const [rows] = await db.execute(`
            SELECT 
                ROLE_CODE AS roleCode,
                ROLE_NAME AS roleName,
                CREATED_AT AS createdAt,
                UPDATED_AT AS updatedAt
            FROM ROLE
            WHERE ROLE_CODE = ?
        `, [roleCode]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลสิทธิ์'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์',
            error: error.message
        });
    }
});

// CREATE new role
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { roleName } = req.body;

        if (!roleName || !roleName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อสิทธิ์'
            });
        }

        const trimmedName = roleName.trim();

        const [existing] = await db.execute(
            'SELECT ROLE_CODE FROM ROLE WHERE LOWER(ROLE_NAME) = LOWER(?)',
            [trimmedName]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'มีชื่อสิทธิ์นี้ในระบบแล้ว'
            });
        }

        const roleCode = await generateRoleCode(db);

        await db.execute(
            'INSERT INTO ROLE (ROLE_CODE, ROLE_NAME) VALUES (?, ?)',
            [roleCode, trimmedName]
        );

        res.status(201).json({
            success: true,
            message: 'สร้างสิทธิ์สำเร็จ',
            data: {
                roleCode,
                roleName: trimmedName
            }
        });
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างสิทธิ์',
            error: error.message
        });
    }
});

// UPDATE role
router.put('/:roleCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { roleCode } = req.params;
        const { roleName } = req.body;

        if (!roleName || !roleName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อสิทธิ์'
            });
        }

        const trimmedName = roleName.trim();

        const [duplicate] = await db.execute(
            'SELECT ROLE_CODE FROM ROLE WHERE LOWER(ROLE_NAME) = LOWER(?) AND ROLE_CODE != ?',
            [trimmedName, roleCode]
        );

        if (duplicate.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'มีชื่อสิทธิ์นี้ในระบบแล้ว'
            });
        }

        const [result] = await db.execute(
            'UPDATE ROLE SET ROLE_NAME = ? WHERE ROLE_CODE = ?',
            [trimmedName, roleCode]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลสิทธิ์'
            });
        }

        res.json({
            success: true,
            message: 'อัปเดตสิทธิ์สำเร็จ',
            data: {
                roleCode,
                roleName: trimmedName
            }
        });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตสิทธิ์',
            error: error.message
        });
    }
});

// DELETE role
router.delete('/:roleCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { roleCode } = req.params;

        const [result] = await db.execute(
            'DELETE FROM ROLE WHERE ROLE_CODE = ?',
            [roleCode]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลสิทธิ์'
            });
        }

        res.json({
            success: true,
            message: 'ลบสิทธิ์สำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบสิทธิ์',
            error: error.message
        });
    }
});

module.exports = router;

