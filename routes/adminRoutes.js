import express from 'express';
import companyController from '../controllers/companyController.js';
import partnerController from '../controllers/partnerController.js';
import employeeController from '../controllers/employeeController.js';
import { requireAuth } from '../middlewares/auth.js';
const router = express.Router();

// Company Routes
router.post('/create-company', requireAuth,companyController.createCompany);
router.get('/companies',requireAuth, companyController.getCompanies);
router.get('/companies/:id',requireAuth, companyController.getCompanyById);
router.put('/companies/:id', requireAuth,companyController.updateCompany);
router.delete('/companies/:id',requireAuth, companyController.deleteCompany);

// Partner Routes
router.post('/create-partner',requireAuth, partnerController.createPartner);
router.get('/partners',requireAuth, partnerController.getPartners);
router.get('/partners/:id',requireAuth, partnerController.getPartnerById);
router.put('/partners/:id', requireAuth,partnerController.updatePartner);
router.delete('/partners/:id', requireAuth,partnerController.deletePartner);

// Employee Routes
router.post('/create-employee',requireAuth, employeeController.createEmployee);
router.get('/employees',requireAuth, employeeController.getEmployees);
router.get('/employees/:id',requireAuth, employeeController.getEmployeeById);
router.put('/employees/:id',requireAuth, employeeController.updateEmployee);
router.delete('/employees/:id',requireAuth, employeeController.deleteEmployee);

export default router;
