import express from 'express';
import authController from '../controllers/authController.js';

const router = express.Router();

// Auth Routes
router.post('/signup', authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyLoginOtp);
router.post('/forgot-password', authController.forgotPassword);
// router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);

export default router;
