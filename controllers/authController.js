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


// Map role => table config
const ROLE_MAP = {
  admin: {
    table: "users",
    idCol: "id",
    emailCol: "email",
    passCol: "password_hash",
    responseUser: (row) => ({
      id: row.id,
      role: "admin",
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
    }),
  },
  company: {
    table: "companies",
    idCol: "id",
    emailCol: "email",
    passCol: "password_hash",
    responseUser: (row) => ({
      id: row.id,
      role: "company",
      email: row.email,
      company_name: row.company_name,
      person_name: row.person_name,
    }),
  },
  partner: {
    table: "partners",
    idCol: "id",
    emailCol: "email",
    passCol: "password_hash",
    responseUser: (row) => ({
      id: row.id,
      role: "partner",
      email: row.email,
      partner_name: row.partner_name,
      person_name: row.person_name,
    }),
  },
};

const getRoleCfg = (role) => ROLE_MAP[String(role || "").toLowerCase()] || null;

const findByEmail = async (cfg, emailNorm) => {
  // LOWER(column) = emailNorm
  return db(cfg.table)
    .whereRaw("LOWER(??) = ?", [cfg.emailCol, emailNorm])
    .first();
};

const login = async (req, res) => {
  try {
    const { role, email, password } = req.body || {};

    const cfg = getRoleCfg(role);
    if (!cfg) {
      return res.status(400).json({ message: "Invalid role. Use admin, company, or partner." });
    }

    const emailNorm = String(email || "").trim().toLowerCase();
    if (!emailNorm || !password) {
      return res.status(400).json({ message: "Role, email and password are required." });
    }

    const account = await findByEmail(cfg, emailNorm);
    if (!account) return res.status(401).json({ message: "Invalid credentials." });

    if (!account[cfg.passCol]) {
      return res.status(400).json({
        message: `This ${role} account has no password set. Please set a password first.`,
      });
    }

    const isMatch = await bcrypt.compare(String(password), String(account[cfg.passCol]));
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials." });

    // OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await db(cfg.table)
      .where({ [cfg.idCol]: account[cfg.idCol] })
      .update({ otp, otp_expires_at });

    await sendOtpEmail(account[cfg.emailCol], otp, "login");

    return res.json({
      message: "OTP sent to your email. Please verify to complete login.",
      otpRequired: true,
      role: String(role).toLowerCase(),
      email: account[cfg.emailCol],
      // ⚠️ remove in production
      otp,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
};

const verifyLoginOtp = async (req, res) => {
  try {
    const { role, email, otp } = req.body || {};

    const cfg = getRoleCfg(role);
    if (!cfg) {
      return res.status(400).json({ message: "Invalid role. Use admin, company, or partner." });
    }

    const emailNorm = String(email || "").trim().toLowerCase();
    const otpNorm = String(otp || "").trim();

    if (!emailNorm || !otpNorm) {
      return res.status(400).json({ message: "Role, email and OTP are required." });
    }

    const account = await findByEmail(cfg, emailNorm);
    if (!account) return res.status(404).json({ message: "Account not found." });

    if (String(account.otp) !== otpNorm) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (!account.otp_expires_at || new Date(account.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired." });
    }

    // JWT
    const token = jwt.sign(
      {
        account_id: account[cfg.idCol],
        role: String(role).toLowerCase(),
        email: account[cfg.emailCol],
        table: cfg.table,
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    const token_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db(cfg.table)
      .where({ [cfg.idCol]: account[cfg.idCol] })
      .update({
        last_login_at: db.fn.now(),
        otp: null,
        otp_expires_at: null,
        token: token,
        token_expires_at,
      });

    return res.json({
      message: "Login successful",
      token,
      user: cfg.responseUser(account),
    });
  } catch (error) {
    console.error("Verify login OTP error:", error);
    return res.status(500).json({ message: "Failed to verify OTP", error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { role, email } = req.body || {};

    const cfg = getRoleCfg(role);
    if (!cfg) {
      return res.status(400).json({ message: "Invalid role. Use admin, company, or partner." });
    }

    const emailNorm = String(email || "").trim().toLowerCase();
    if (!emailNorm) return res.status(400).json({ message: "Role and email are required." });

    const account = await findByEmail(cfg, emailNorm);

    // generic response (avoid enumeration)
    if (!account) return res.json({ message: "If that email exists, a reset link has been sent." });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const resetHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

    await db(cfg.table)
      .where({ [cfg.idCol]: account[cfg.idCol] })
      .update({
        token: resetHash,
        token_expires_at: resetExpires,
      });

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink =
      `${baseUrl}/reset-password?role=${encodeURIComponent(String(role).toLowerCase())}` +
      `&token=${rawToken}&email=${encodeURIComponent(account[cfg.emailCol])}`;

    await sendOtpEmail(account[cfg.emailCol], resetLink, "reset_link");

    return res.json({ message: "Reset password link sent to your email." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Failed to process request", error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { role, email, token, newPassword } = req.body || {};

    const cfg = getRoleCfg(role);
    if (!cfg) {
      return res.status(400).json({ message: "Invalid role. Use admin, company, or partner." });
    }

    const emailNorm = String(email || "").trim().toLowerCase();
    const rawToken = String(token || "").trim();

    if (!emailNorm || !rawToken || !newPassword) {
      return res.status(400).json({ message: "Role, email, token, and newPassword are required." });
    }

    const account = await findByEmail(cfg, emailNorm);

    if (
      !account ||
      !account.token ||
      !account.token_expires_at ||
      new Date(account.token_expires_at).getTime() < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    const incomingHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    if (incomingHash !== account.reset_token_hash) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    const password_hash = await bcrypt.hash(String(newPassword), 10);

    await db(cfg.table)
      .where({ [cfg.idCol]: account[cfg.idCol] })
      .update({
        password_hash,
        token_hash: null,
        token_expires_at: null,
      });

    return res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Failed to reset password", error: error.message });
  }
};



export default {
    register,
    login,
    verifyLoginOtp,
    forgotPassword,
    resetPassword
};
