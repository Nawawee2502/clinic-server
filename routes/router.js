const express = require('express');
const router = express.Router();

// Import all route modules
const provinceRoutes = require('./province');
const ampherRoutes = require('./ampher');
const tumbolRoutes = require('./tumbol');
const patientRoutes = require('./patient');
const employeeRoutes = require('./employee');
const drugRoutes = require('./drug');
const diagnosisRoutes = require('./diagnosis');
const icd10Routes = require('./icd10');
const procedureRoutes = require('./procedure');
const labRoutes = require('./lab');
const radiologicalRoutes = require('./radiological');
const ixRoutes = require('./ix');
const treatmentRoutes = require('./treatment');
const unitPackageRoutes = require('./unit-package');
const appointmentRoutes = require('./appointment');
const queueRoutes = require('./queue');
const userRoutes = require('./users');
const clinicOrgRoutes = require('./clinic-org');
const bankRoutes = require('./bank');
const bookBankRoutes = require('./book-bank');
const roleRoutes = require('./role');
const typepayRoutes = require('./typepay');
const typeincomeRoutes = require('./typeincome');
const supplierRoutes = require('./supplier');
const pay1Routes = require('./pay1');
const income1Routes = require('./income1');

// ✅ เพิ่ม 5 routes ใหม่
const balMonthDrugRoutes = require('./balmonthdrug');
const borrow1Routes = require('./borrow1');
const checkStockRoutes = require('./check_stock');
const receipt1Routes = require('./receipt1');
const return1Routes = require('./return1');
const balDrugRoutes = require('./bal-drug');
const stockCardRoutes = require('./stock_card');
const balCashRoutes = require('./bal-cash');
const balBankRoutes = require('./bal-bank');
const typeDrugRoutes = require('./type-drug');



// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
    });
});

// Test endpoint
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'API Test Successful',
        timestamp: new Date().toISOString(),
        endpoints_available: {
            location: ['provinces', 'amphers', 'tumbols'],
            patient_staff: ['patients', 'employees'],
            user_management: ['users', 'roles'],
            medical: ['drugs', 'procedures', 'diagnosis', 'icd10'],
            testing: ['lab', 'radiological', 'ix'],
            treatment: ['treatments'],
            appointment: ['appointments', 'queue'],
            utilities: ['units', 'packages'],
            finance: ['typepay', 'typeincome', 'supplier', 'bank', 'book-bank', 'pay1', 'income1'],
            inventory: ['bal_month_drug', 'borrow1', 'check_stock', 'receipt1', 'return1', 'stock_card']
        }
    });
});

// API Documentation endpoint
router.get('/docs', (req, res) => {
    res.json({
        success: true,
        title: 'Clinic Management System API Documentation',
        version: '1.0.0',
        description: 'RESTful API for clinic management system',
        base_url: `${req.protocol}://${req.get('host')}/api`,
        endpoints: {
            // System endpoints
            'GET /health': 'System health check',
            'GET /test': 'API test endpoint',
            'GET /docs': 'API documentation',

            // Location APIs
            'GET /provinces': 'Get all provinces',
            'GET /provinces/:code': 'Get province by code',
            'POST /provinces': 'Create new province',
            'PUT /provinces/:code': 'Update province',
            'DELETE /provinces/:code': 'Delete province',

            'GET /amphers': 'Get all amphers',
            'GET /amphers/province/:code': 'Get amphers by province',
            'GET /amphers/:code': 'Get ampher by code',
            'POST /amphers': 'Create new ampher',
            'PUT /amphers/:code': 'Update ampher',
            'DELETE /amphers/:code': 'Delete ampher',

            'GET /tumbols': 'Get all tumbols',
            'GET /tumbols/ampher/:code': 'Get tumbols by ampher',
            'GET /tumbols/province/:code': 'Get tumbols by province',
            'GET /tumbols/:code': 'Get tumbol by code',
            'POST /tumbols': 'Create new tumbol',
            'PUT /tumbols/:code': 'Update tumbol',
            'DELETE /tumbols/:code': 'Delete tumbol',

            // Patient & Staff APIs
            'GET /patients': 'Get all patients (limited)',
            'GET /patients/:hn': 'Get patient by HN',
            'GET /patients/search/:term': 'Search patients',
            'GET /patients/province/:code': 'Get patients by province',
            'GET /patients/stats/basic': 'Get patient statistics',
            'POST /patients': 'Create new patient',
            'PUT /patients/:hn': 'Update patient',
            'DELETE /patients/:hn': 'Delete patient',

            'GET /employees': 'Get all employees',
            'GET /employees/:code': 'Get employee by code',
            'GET /employees/type/:type': 'Get employees by type',
            'GET /employees/search/:term': 'Search employees',
            'GET /employees/stats/summary': 'Get employee statistics',
            'POST /employees': 'Create new employee',
            'PUT /employees/:code': 'Update employee',
            'DELETE /employees/:code': 'Delete employee',

            // Role Management APIs
            'GET /roles': 'Get all roles (admin only)',
            'GET /roles/:roleCode': 'Get role by code',
            'POST /roles': 'Create new role (admin only)',
            'PUT /roles/:roleCode': 'Update role (admin only)',
            'DELETE /roles/:roleCode': 'Delete role (admin only)',

            // Medical Resources APIs
            'GET /drugs': 'Get all drugs (paginated)',
            'GET /drugs/:code': 'Get drug by code',
            'GET /drugs/search/:term': 'Search drugs',
            'GET /drugs/indication/:indication': 'Get drugs by indication',
            'GET /drugs/stats/summary': 'Get drug statistics',
            'POST /drugs': 'Create new drug',
            'PUT /drugs/:code': 'Update drug',
            'DELETE /drugs/:code': 'Delete drug',

            'GET /procedures': 'Get all medical procedures (paginated)',
            'GET /procedures/:code': 'Get procedure by code',
            'GET /procedures/search/:term': 'Search procedures',
            'GET /procedures/type/:type': 'Get procedures by type',
            'GET /procedures/types/list': 'Get procedure types',
            'GET /procedures/stats/summary': 'Get procedure statistics',
            'POST /procedures': 'Create new procedure',
            'PUT /procedures/:code': 'Update procedure',
            'DELETE /procedures/:code': 'Delete procedure',

            // Medical Coding APIs
            'GET /diagnosis': 'Get all diagnosis codes (paginated)',
            'GET /diagnosis/:code': 'Get diagnosis by code',
            'GET /diagnosis/search/:term': 'Search diagnosis',
            'POST /diagnosis': 'Create new diagnosis',
            'PUT /diagnosis/:code': 'Update diagnosis',
            'DELETE /diagnosis/:code': 'Delete diagnosis',

            'GET /icd10': 'Get all ICD-10 codes (paginated)',
            'GET /icd10/:code': 'Get ICD-10 by code',
            'GET /icd10/search/:term': 'Search ICD-10',
            'GET /icd10/category/:term': 'Get ICD-10 by category',
            'GET /icd10/categories/list': 'Get ICD-10 categories',
            'GET /icd10/stats/summary': 'Get ICD-10 statistics',
            'POST /icd10': 'Create new ICD-10',
            'PUT /icd10/:code': 'Update ICD-10',
            'DELETE /icd10/:code': 'Delete ICD-10',

            // Laboratory & Radiology APIs
            'GET /lab': 'Get all lab tests',
            'GET /lab/:code': 'Get lab test by code',
            'GET /lab/search/:term': 'Search lab tests',
            'POST /lab': 'Create new lab test',
            'PUT /lab/:code': 'Update lab test',
            'DELETE /lab/:code': 'Delete lab test',

            'GET /radiological': 'Get all radiological tests',
            'GET /radiological/:code': 'Get radiological test by code',
            'GET /radiological/search/:term': 'Search radiological tests',
            'POST /radiological': 'Create new radiological test',
            'PUT /radiological/:code': 'Update radiological test',
            'DELETE /radiological/:code': 'Delete radiological test',

            'GET /ix': 'Get all investigations',
            'GET /ix/:code': 'Get investigation by code',
            'GET /ix/search/:term': 'Search investigations',
            'POST /ix': 'Create new investigation',
            'PUT /ix/:code': 'Update investigation',
            'DELETE /ix/:code': 'Delete investigation',

            // Treatment APIs
            'GET /treatments': 'Get all treatments (paginated)',
            'GET /treatments/:vno': 'Get treatment by VNO (full details)',
            'GET /treatments/patient/:hn': 'Get treatments by patient HN',
            'GET /treatments/stats/summary': 'Get treatment statistics',
            'POST /treatments': 'Create new treatment',
            'PUT /treatments/:vno/status': 'Update treatment status',

            // Appointment & Queue APIs
            'GET /appointments': 'Get all appointments (paginated)',
            'GET /appointments/:id': 'Get appointment by ID',
            'GET /appointments/date/:date': 'Get appointments by date',
            'GET /appointments/patient/:hn': 'Get appointments by patient',
            'GET /appointments/stats/summary': 'Get appointment statistics',
            'POST /appointments': 'Create new appointment',
            'PUT /appointments/:id': 'Update appointment',
            'PUT /appointments/:id/status': 'Update appointment status',
            'DELETE /appointments/:id': 'Delete appointment',

            'GET /queue/today': 'Get today\'s queue',
            'GET /queue/appointments/today': 'Get today\'s appointments',
            'GET /queue/stats': 'Get queue statistics',
            'POST /queue/create': 'Create walk-in queue',
            'POST /queue/checkin': 'Check-in from appointment',
            'PUT /queue/:id/status': 'Update queue status',
            'DELETE /queue/:id': 'Remove queue',

            // Utility APIs
            'GET /units': 'Get all units',
            'GET /units/:code': 'Get unit by code',
            'POST /units': 'Create new unit',
            'PUT /units/:code': 'Update unit',
            'DELETE /units/:code': 'Delete unit',

            'GET /packages': 'Get all packages',
            'GET /packages/:code': 'Get package by code',
            'POST /packages': 'Create new package',
            'PUT /packages/:code': 'Update package',
            'DELETE /packages/:code': 'Delete package',

            'GET /stats/summary': 'Get combined unit/package statistics',

            // Financial APIs
            'GET /typepay': 'Get all payment types',
            'GET /typepay/:code': 'Get payment type by code',
            'GET /typepay/search/:term': 'Search payment types',
            'POST /typepay': 'Create new payment type',
            'PUT /typepay/:code': 'Update payment type',
            'DELETE /typepay/:code': 'Delete payment type',

            'GET /typeincome': 'Get all income types',
            'GET /typeincome/:code': 'Get income type by code',
            'GET /typeincome/search/:term': 'Search income types',
            'POST /typeincome': 'Create new income type',
            'PUT /typeincome/:code': 'Update income type',
            'DELETE /typeincome/:code': 'Delete income type',

            'GET /supplier': 'Get all suppliers',
            'GET /supplier/:code': 'Get supplier by code',
            'GET /supplier/search/:term': 'Search suppliers',
            'GET /supplier/check/:code': 'Check if supplier code exists',
            'GET /supplier/stats/summary': 'Get supplier statistics',
            'POST /supplier': 'Create new supplier',
            'PUT /supplier/:code': 'Update supplier',
            'DELETE /supplier/:code': 'Delete supplier',

            'GET /bank': 'Get all banks',
            'GET /book-bank': 'Get all book banks',

            // PAY1 APIs
            'GET /pay1': 'Get all pay1 records (paginated)',
            'GET /pay1/:refno': 'Get pay1 by REFNO with details',
            'GET /pay1/search/:term': 'Search pay1 records',
            'GET /pay1/generate/refno': 'Generate next REFNO',
            'GET /pay1/stats/summary': 'Get pay1 statistics',
            'GET /pay1/period/:year/:month': 'Get pay1 by period',
            'POST /pay1': 'Create new pay1 with details',
            'PUT /pay1/:refno': 'Update pay1 with details',
            'DELETE /pay1/:refno': 'Delete pay1 with details',

            // INCOME1 APIs
            'GET /income1': 'Get all income1 records (paginated)',
            'GET /income1/:refno': 'Get income1 by REFNO with details',
            'GET /income1/search/:term': 'Search income1 records',
            'GET /income1/generate/refno': 'Generate next REFNO',
            'GET /income1/stats/summary': 'Get income1 statistics',
            'GET /income1/period/:year/:month': 'Get income1 by period',
            'POST /income1': 'Create new income1 with details',
            'PUT /income1/:refno': 'Update income1 with details',
            'DELETE /income1/:refno': 'Delete income1 with details',

            // ✅ BAL_MONTH_DRUG APIs
            'GET /bal_month_drug': 'Get all balance records (with optional filters)',
            'GET /bal_month_drug/stats/summary': 'Get balance statistics',
            'GET /bal_month_drug/period/:year/:month': 'Get balance by period',
            'GET /bal_month_drug/drug/:drugCode': 'Get balance by drug code',
            'GET /bal_month_drug/:year/:month/:drugCode': 'Get specific balance record',
            'GET /bal_month_drug/search/:term': 'Search balance records',
            'GET /bal_month_drug/check/:year/:month/:drugCode': 'Check if record exists',
            'POST /bal_month_drug': 'Create new balance record',
            'PUT /bal_month_drug/:year/:month/:drugCode': 'Update balance record',
            'DELETE /bal_month_drug/:year/:month/:drugCode': 'Delete balance record',
            'DELETE /bal_month_drug/period/:year/:month': 'Delete all records for period',

            // ✅ BORROW1 APIs
            'GET /borrow1': 'Get all borrow1 records (paginated)',
            'GET /borrow1/:refno': 'Get borrow1 by REFNO with details',
            'GET /borrow1/search/:term': 'Search borrow1 records',
            'GET /borrow1/generate/refno': 'Generate next REFNO',
            'GET /borrow1/stats/summary': 'Get borrow1 statistics',
            'GET /borrow1/period/:year/:month': 'Get borrow1 by period',
            'POST /borrow1': 'Create new borrow1 with details',
            'PUT /borrow1/:refno': 'Update borrow1 with details',
            'DELETE /borrow1/:refno': 'Delete borrow1 with details',

            // ✅ CHECK_STOCK APIs
            'GET /check_stock': 'Get all check_stock records (paginated)',
            'GET /check_stock/:refno': 'Get check_stock by REFNO with details',
            'GET /check_stock/search/:term': 'Search check_stock records',
            'GET /check_stock/generate/refno': 'Generate next REFNO',
            'GET /check_stock/stats/summary': 'Get check_stock statistics',
            'GET /check_stock/period/:year/:month': 'Get check_stock by period',
            'POST /check_stock': 'Create new check_stock with details',
            'PUT /check_stock/:refno': 'Update check_stock with details',
            'DELETE /check_stock/:refno': 'Delete check_stock with details',

            // ✅ RECEIPT1 APIs
            'GET /receipt1': 'Get all receipt1 records (paginated)',
            'GET /receipt1/:refno': 'Get receipt1 by REFNO with details',
            'GET /receipt1/search/:term': 'Search receipt1 records',
            'GET /receipt1/generate/refno': 'Generate next REFNO',
            'GET /receipt1/stats/summary': 'Get receipt1 statistics',
            'GET /receipt1/period/:year/:month': 'Get receipt1 by period',
            'POST /receipt1': 'Create new receipt1 with details',
            'PUT /receipt1/:refno': 'Update receipt1 with details',
            'DELETE /receipt1/:refno': 'Delete receipt1 with details',

            // ✅ RETURN1 APIs
            'GET /return1': 'Get all return1 records (paginated)',
            'GET /return1/:refno': 'Get return1 by REFNO with details',
            'GET /return1/search/:term': 'Search return1 records',
            'GET /return1/generate/refno': 'Generate next REFNO',
            'GET /return1/stats/summary': 'Get return1 statistics',
            'GET /return1/period/:year/:month': 'Get return1 by period',
            'POST /return1': 'Create new return1 with details',
            'PUT /return1/:refno': 'Update return1 with details',
            'DELETE /return1/:refno': 'Delete return1 with details',

            // ✅ STOCK_CARD APIs
            'GET /stock_card': 'Get all stock card records (with optional filters)',
            'GET /stock_card/stats/summary': 'Get stock card statistics',
            'GET /stock_card/period/:year/:month': 'Get stock cards by period',
            'GET /stock_card/drug/:drugCode': 'Get stock cards by drug code',
            'GET /stock_card/refno/:refno': 'Get stock cards by REFNO',
            'GET /stock_card/:year/:month/:drugCode/:refno': 'Get specific stock card record',
            'GET /stock_card/search/:term': 'Search stock card records',
            'POST /stock_card': 'Create new stock card record',
            'PUT /stock_card/:year/:month/:drugCode/:refno': 'Update stock card record',
            'DELETE /stock_card/:year/:month/:drugCode/:refno': 'Delete stock card record',
            'DELETE /stock_card/refno/:refno': 'Delete stock cards by REFNO',
            'DELETE /stock_card/period/:year/:month': 'Delete stock cards by period',
        },
        notes: {
            pagination: 'Most list endpoints support ?page=1&limit=50 parameters',
            search: 'Search endpoints support partial matching',
            filtering: 'Some endpoints support additional filter parameters',
            status_codes: {
                200: 'Success',
                201: 'Created',
                400: 'Bad Request',
                404: 'Not Found',
                409: 'Conflict (duplicate/reference)',
                500: 'Internal Server Error'
            }
        }
    });
});

// Mount routes
// Location APIs
router.use('/provinces', provinceRoutes);
router.use('/amphers', ampherRoutes);
router.use('/tumbols', tumbolRoutes);

// Patient & Staff APIs
router.use('/patients', patientRoutes);
router.use('/employees', employeeRoutes);

// Medical Resources APIs
router.use('/drugs', drugRoutes);
router.use('/procedures', procedureRoutes);

// Medical Coding APIs
router.use('/diagnosis', diagnosisRoutes);
router.use('/icd10', icd10Routes);

// Laboratory & Radiology APIs
router.use('/lab', labRoutes);
router.use('/radiological', radiologicalRoutes);
router.use('/ix', ixRoutes);

// Treatment APIs
router.use('/treatments', treatmentRoutes);

// Appointment & Queue APIs
router.use('/appointments', appointmentRoutes);
router.use('/queue', queueRoutes);

// User & Organization APIs
router.use('/users', userRoutes);
router.use('/clinic-org', clinicOrgRoutes);
router.use('/roles', roleRoutes);

// Financial APIs
router.use('/bank', bankRoutes);
router.use('/book-bank', bookBankRoutes);
router.use('/typepay', typepayRoutes);
router.use('/typeincome', typeincomeRoutes);
router.use('/supplier', supplierRoutes);
router.use('/pay1', pay1Routes);
router.use('/income1', income1Routes);

// ✅ Inventory Management APIs (5 routes ใหม่)
router.use('/bal_month_drug', balMonthDrugRoutes);
router.use('/borrow1', borrow1Routes);
router.use('/check_stock', checkStockRoutes);
router.use('/receipt1', receipt1Routes);
router.use('/return1', return1Routes);
router.use('/bal_drug', balDrugRoutes);
router.use('/stock_card', stockCardRoutes);
router.use('/bal_cash', balCashRoutes);
router.use('/bal_bank', balBankRoutes);
router.use('/type_drug', typeDrugRoutes);


// Utility APIs (handled by unit-package.js)
router.use('/', unitPackageRoutes); // This handles /units and /packages

module.exports = router;