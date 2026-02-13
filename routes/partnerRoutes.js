import express from 'express';
import consultationController from '../controllers/consultationController.js';
import doctorReferralController from '../controllers/doctorReferralController.js';
import { requireAuth } from '../middlewares/auth.js';
import partnerController from '../controllers/partnerController.js';

const router = express.Router();

// Consultation Routes
router.post('/create-consultation', consultationController.createConsultation);
router.get('/consultations', consultationController.getConsultations);

// Doctor Referral Routes
router.post('/create-referral', doctorReferralController.createDoctorReferral);
router.get('/referrals', doctorReferralController.getDoctorReferrals);


router.get('/get-profile/:id', requireAuth, partnerController.getPartnerProfile);

// Update partner profile route (only the logged-in partner can update their profile)
router.put('/update-profile/:id',requireAuth, partnerController.updatePartnerProfile);

export default router;
