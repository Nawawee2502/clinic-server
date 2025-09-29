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
            medical: ['drugs', 'procedures', 'diagnosis', 'icd10'],
            testing: ['lab', 'radiological', 'ix'],
            treatment: ['treatments'],
            appointment: ['appointments', 'queue'],
            utilities: ['units', 'packages']
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

            'GET /stats/summary': 'Get combined unit/package statistics'
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

router.use('/users', userRoutes);

router.use('/clinic-org', clinicOrgRoutes);

// Utility APIs (handled by unit-package.js)
router.use('/', unitPackageRoutes); // This handles /units and /packages

module.exports = router;