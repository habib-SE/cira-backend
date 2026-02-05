import express from 'express';
import consultationController from '../controllers/consultationController.js';
import doctorReferralController from '../controllers/doctorReferralController.js';

const router = express.Router();

// Consultation Routes
router.post('/create-consultation', consultationController.createConsultation);
router.get('/consultations', consultationController.getConsultations);

// Doctor Referral Routes
router.post('/create-referral', doctorReferralController.createDoctorReferral);
router.get('/referrals', doctorReferralController.getDoctorReferrals);

export default router;
