import express from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import companyRoutes from './companyRoutes.js';
import partnerRoutes from './partnerRoutes.js';
import cloudRoute from "./cloudRoute.js";
import consultationController from '../controllers/consultationController.js';
import doctorReferralController from '../controllers/doctorReferralController.js';
import dashboardRoute from "./dashboardRoute.js";
const router = express.Router();

// Auth Routes (public)
router.use('/auth', authRoutes);

// Admin Routes
router.use('/admin', adminRoutes);

// Company Routes
router.use('/company', companyRoutes);

// Dashboard Route
router.use("/dashboard", dashboardRoute);

// Partner Routes
router.use('/partner', partnerRoutes);

//cira cloud
router.use("/cira-cloud", cloudRoute);

// General Consultation & Referral Routes (can be accessed by multiple roles)
router.post('/create-consultation/:user_id', consultationController.createConsultation);
router.get('/consultations', consultationController.getConsultations);
router.post('/doctor-referrals', doctorReferralController.createDoctorReferral);
router.get('/doctor-referrals', doctorReferralController.getDoctorReferrals);

export default router;
