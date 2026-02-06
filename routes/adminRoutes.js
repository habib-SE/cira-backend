import express from 'express';
import companyController from '../controllers/companyController.js';
import partnerController from '../controllers/partnerController.js';
import { requireAuth } from '../middlewares/auth.js';
const router = express.Router();

// Company Routes
router.post('/create-company', requireAuth,companyController.createCompany);
router.get('/get-all-companies',requireAuth, companyController.getCompanies);
router.get('/get-comapny/:id',requireAuth, companyController.getCompanyById);
router.put('/update-company/:id', requireAuth,companyController.updateCompany);
router.delete('/delete-company/:id',requireAuth, companyController.deleteCompany);

// Partner Routes
router.post('/create-partner',requireAuth, partnerController.createPartner);
router.get('/get-all-partners',requireAuth, partnerController.getPartners);
router.get('/get-partner/:id',requireAuth, partnerController.getPartnerById);
router.put('/update-partner/:id', requireAuth,partnerController.updatePartner);
router.delete('/delete-partner/:id', requireAuth,partnerController.deletePartner);


export default router;
