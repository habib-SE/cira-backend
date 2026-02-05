import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Send OTP email
export const sendOtpEmail = async (email, otp, type = 'login') => {
    try {
        const subject = type === 'login' ? 'Your Login OTP' : 'Password Reset OTP';
        const message = type === 'login'
            ? `Your OTP for login is: ${otp}. This code will expire in 10 minutes.`
            : `Your OTP for password reset is: ${otp}. This code will expire in 15 minutes.`;

        const mailOptions = {
            from: `"Cira Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Cira Authentication</h2>
                    <p style="font-size: 16px; color: #555;">${message}</p>
                    <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #4CAF50; margin: 0; letter-spacing: 5px;">${otp}</h1>
                    </div>
                    <p style="font-size: 14px; color: #888;">If you didn't request this, please ignore this email.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
};

export default { sendOtpEmail };
