import db from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendOtpEmail } from '../utils/emailService.js';
import crypto from "crypto";
import { JWT_SECRET } from '../config/jwt.js';
const TABLE_NAME = 'users';

const register = async (req, res) => {
    try {
        const { first_name, last_name, email, password, role, phone } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ message: 'Email, password, and role are required.' });
        }

        const existingUser = await db(TABLE_NAME).where({ email }).first();
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists.' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const newUser = {
            first_name,
            last_name,
            email,
            password_hash,
            role,
            phone,
            otp: null,
            otp_expires_at: null,
        };

        const [id] = await db(TABLE_NAME).insert(newUser);

        res.status(201).json({ message: 'User registered successfully', userId: id });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

// const login = async (req, res) => {
//     try {
//         const { email, password } = req.body;

//         if (!email || !password) {
//             return res.status(400).json({ message: 'Email and password are required.' });
//         }

//         const user = await db(TABLE_NAME).where({ email }).first();
//         if (!user) {
//             return res.status(401).json({ message: 'Invalid credentials.' });
//         }

//         const isMatch = await bcrypt.compare(password, user.password_hash);
//         if (!isMatch) {
//             return res.status(401).json({ message: 'Invalid credentials.' });
//         }

//         // Generate 6-digit OTP for login
//         const otp = Math.floor(100000 + Math.random() * 900000).toString();
//         const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

//         // Store OTP in users table
//         await db(TABLE_NAME).where({ email }).update({
//             otp,
//             otp_expires_at
//         });

//         // Send OTP via email
//         await sendOtpEmail(email, otp, 'login');
//         console.log(`Login OTP for ${email}: ${otp}`); // Keep for debugging

//         res.json({
//             message: 'OTP sent to your email. Please verify to complete login.',
//             email,
//             otp // Remove this in production
//         });
//     } catch (error) {
//         console.error('Login error:', error);
//         res.status(500).json({ message: 'Login failed', error: error.message });
//     }
// };
const login = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        // ✅ find user (case-insensitive + trimmed)
        const user = await db(TABLE_NAME)
            .whereRaw("LOWER(email)=LOWER(?)", [String(email).trim()])
            .first();

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        // ✅ verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        // ✅ generate OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // ✅ store OTP in users table
        const updated = await db(TABLE_NAME)
            .where({ id: user.id }) // safest match
            .update({ otp, otp_expires_at });

        if (!updated) {
            return res.status(500).json({
                message: "OTP not stored in DB. Update affected 0 rows.",
            });
        }

        // ✅ send OTP email (use stored DB email to avoid mismatch)
        await sendOtpEmail(user.email, otp, "login");

        return res.json({
            message: "OTP sent to your email. Please verify to complete login.",
            otpRequired: true,
            email: user.email,
            // ❌ don't return otp in production
            otp,
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Login failed", error: error.message });
    }
};


const verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    const emailNorm = String(email || "").trim().toLowerCase();

    if (!emailNorm || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await db(TABLE_NAME)
      .whereRaw("LOWER(email)=?", [emailNorm])
      .first();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (String(user.otp) !== String(otp).trim()) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (!user.otp_expires_at || new Date(user.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired." });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    const token_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // ✅ store SAME token in DB
    await db(TABLE_NAME).where({ id: user.id }).update({
      last_login_at: db.fn.now(),
      otp: null,
      otp_expires_at: null,
      token,
      token_expires_at,
    });

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    console.error("Verify login OTP error:", error);
    return res.status(500).json({ message: "Failed to verify OTP", error: error.message });
  }
};


const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        const user = await db(TABLE_NAME)
            .whereRaw("LOWER(email)=LOWER(?)", [String(email).trim()])
            .first();

        // ✅ generic response to avoid user enumeration
        if (!user) {
            return res.json({ message: "If that email exists, a reset link has been sent." });
        }

        // ✅ create secure reset token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // ✅ store token hash + expiry in users table
        await db(TABLE_NAME).where({ id: user.id }).update({
            token_hash: tokenHash,
            token_expires_at: expiresAt,
        });

        // ✅ reset link (frontend page)
        const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const resetLink = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(
            user.email
        )}`;

        // ✅ send email with link
        await sendOtpEmail(user.email, resetLink, "reset_link");

        console.log("Reset link:", resetLink);

        return res.json({ message: "Reset password link sent to your email." });
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({
            message: "Failed to process request",
            error: error.message,
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, token, newPassword } = req.body || {};

        if (!email || !token || !newPassword) {
            return res.status(400).json({
                message: "Email, token, and new password are required.",
            });
        }

        const user = await db(TABLE_NAME)
            .whereRaw("LOWER(email)=LOWER(?)", [String(email).trim()])
            .first();

        // ✅ we are using token_hash + token_expires_at
        if (!user || !user.token_hash || !user.token_expires_at) {
            return res.status(400).json({ message: "Invalid or expired reset token." });
        }

        if (new Date(user.token_expires_at).getTime() < Date.now()) {
            return res.status(400).json({ message: "Reset token expired." });
        }

        const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");

        if (tokenHash !== user.token_hash) {
            return res.status(400).json({ message: "Invalid or expired reset token." });
        }

        const password_hash = await bcrypt.hash(newPassword, 10);

        // ✅ update password + clear token
        await db(TABLE_NAME).where({ id: user.id }).update({
            password_hash,
            token_hash: null,
            token_expires_at: null,
        });

        return res.json({ message: "Password reset successfully." });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({
            message: "Failed to reset password",
            error: error.message,
        });
    }
};



export default {
    register,
    login,
    verifyLoginOtp,
    forgotPassword,
    resetPassword
};
