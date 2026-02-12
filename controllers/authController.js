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
      image_url: req.body.image_url || null, 
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
      image_url: row.image_url || null, 
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
      image_url: row.image_url || null, 
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
        image_url: row.image_url || null, 
    }),
  },
  employee: {
    table: "employees",
    idCol: "id",
    emailCol: "email",
    passCol: "password_hash",
    responseUser: (row) => ({
      id: row.id,
      role: "employee",
      email: row.email,
      employee_name: row.employee_name,
        image_url: row.image_url || null, 
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
      return res.status(400).json({ message: "Invalid role. Use admin, company,employee or partner." });
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
      return res.status(400).json({ message: "Invalid role. Use admin, company, employee , or partner." });
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
      image_url: account.image_url || null,
    });
  } catch (error) {
    console.error("Verify login OTP error:", error);
    return res.status(500).json({ message: "Failed to verify OTP", error: error.message });
  }
};


export const forgotPassword = async (req, res) => {
  try {
    const { role, email } = req.body || {};

    const cfg = getRoleCfg(role);
    if (!cfg) {
      return res.status(400).json({ message: "Invalid role. Use admin, company, employee, or partner." });
    }

    const emailNorm = String(email || "").trim().toLowerCase();
    if (!emailNorm) {
      return res.status(400).json({ message: "Role and email are required." });
    }

    const account = await findByEmail(cfg, emailNorm);

    // ✅ generic response (avoid enumeration)
    if (!account) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    // ✅ JWT reset token (15 minutes) -> this will look like eyJhbGciOi...
    const token = jwt.sign(
      {
        account_id: account[cfg.idCol],
        role: String(role).toLowerCase(),
        email: account[cfg.emailCol],
        table: cfg.table,
      },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const token_expires_at = new Date(Date.now() + 15 * 60 * 1000);

    // ✅ IMPORTANT: store RAW JWT token (not hash, not random hex)
    await db(cfg.table)
      .where({ [cfg.idCol]: account[cfg.idCol] })
      .update({
        token: token,
        token_expires_at: token_expires_at,
      });

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const resetLink =
      `${baseUrl}/auth/reset-password` +
      `?role=${encodeURIComponent(String(role).toLowerCase())}` +
      `&token=${encodeURIComponent(token)}` +
      `&email=${encodeURIComponent(account[cfg.emailCol])}`;

    await sendOtpEmail(account[cfg.emailCol], resetLink, "reset_link");

    // ✅ For Postman testing ONLY (optional): uncomment to see JWT in response
    // return res.json({ message: "Reset password link sent to your email.", token });

    return res.json({ message: "Reset password link sent to your email." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Failed to process request", error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { role, email, token, newPassword, confirmPassword } = req.body || {};

    const cfg = getRoleCfg(role);
    if (!cfg) {
      return res.status(400).json({ message: "Invalid role. Use admin, company, employee, or partner." });
    }

    const emailNorm = String(email || "").trim().toLowerCase();
    const rawToken = String(token || "").trim();

    if (!emailNorm || !rawToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Role, email, token, newPassword and confirmPassword are required.",
      });
    }

    if (String(newPassword) !== String(confirmPassword)) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    // ✅ verify JWT (expiry/signature checked here)
    let payload;
    try {
      payload = jwt.verify(rawToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    // ✅ ensure role/email/table match
    if (
      String(payload?.role || "").toLowerCase() !== String(role).toLowerCase() ||
      String(payload?.email || "").toLowerCase() !== emailNorm ||
      String(payload?.table || "") !== String(cfg.table)
    ) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    const account = await findByEmail(cfg, emailNorm);

    // ✅ token must exist in DB
    if (!account || !account.token || !account.token_expires_at) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    // ✅ DB expiry check (extra protection)
    if (new Date(account.token_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    // ✅ compare RAW JWT exactly with stored token
    if (String(account.token).trim() !== rawToken) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    const passwordCol = cfg.passwordCol || "password_hash";
    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    await db(cfg.table)
      .where({ [cfg.idCol]: account[cfg.idCol] })
      .update({
        [passwordCol]: passwordHash,
        token: null,
        token_expires_at: null,
      });

    return res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Failed to reset password", error: error.message });
  }
};




// ✅ Public response for admin user (safe fields only)
const mapAdminUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role, // should be "admin" typically
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at,
  };
};

// ✅ GET /users/:id
export const getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Valid user id is required." });
    }

    const user = await db(TABLE_NAME)
      .select(
        "id",
        "role",
        "email",
        "first_name",
        "last_name",
        "phone",
        "created_at",
        "updated_at",
        "last_login_at"
      )
      .where({ id })
      .first();

    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({ message: "User fetched successfully.", data: mapAdminUser(user) });
  } catch (error) {
    console.error("getUserById error:", error);
    return res.status(500).json({ message: "Failed to fetch user", error: error.message });
  }
};

// ✅ PUT /admin/users/:id  (or /users/:id for admin update)
export const updateAdminUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Valid user id is required." });
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      password, // optional
      // role, // ❌ generally don't allow changing role here (optional)
    } = req.body || {};

    // ✅ Ensure user exists
    const existing = await db(TABLE_NAME).where({ id }).first();
    if (!existing) return res.status(404).json({ message: "User not found." });

    // ✅ Email normalize + unique check (only within users table)
    let emailNorm = null;
    if (email !== undefined) {
      emailNorm = String(email || "").trim().toLowerCase();
      if (!emailNorm) {
        return res.status(400).json({ message: "Email cannot be empty." });
      }

      const dup = await db(TABLE_NAME)
        .whereRaw("LOWER(email) = ?", [emailNorm])
        .andWhereNot({ id })
        .first();

      if (dup) {
        return res.status(400).json({ message: "Email already exists in users." });
      }
    }

    // ✅ Build update payload
    const updatePayload = {};

    if (first_name !== undefined) updatePayload.first_name = String(first_name || "").trim();
    if (last_name !== undefined) updatePayload.last_name = String(last_name || "").trim();
    if (email !== undefined) updatePayload.email = emailNorm; // store normalized
    if (phone !== undefined) updatePayload.phone = String(phone || "").trim();

    // ✅ Password update (optional)
    if (password !== undefined) {
      const pass = String(password || "").trim();
      if (pass.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
      }
      updatePayload.password_hash = await bcrypt.hash(pass, 10);
    }

    // If your table has updated_at and you want to update it manually:
    // updatePayload.updated_at = db.fn.now();

    // ✅ Nothing to update
    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ message: "No fields provided to update." });
    }

    await db(TABLE_NAME).where({ id }).update(updatePayload);

    // ✅ Return updated user
    const updated = await db(TABLE_NAME)
      .select(
        "id",
        "role",
        "email",
        "first_name",
        "last_name",
        "phone",
        "created_at",
        "updated_at",
        "last_login_at"
      )
      .where({ id })
      .first();

    return res.json({
      message: "Admin user updated successfully.",
      data: mapAdminUser(updated),
    });
  } catch (error) {
    console.error("updateAdminUser error:", error);
    return res.status(500).json({ message: "Failed to update user", error: error.message });
  }
};



export default {
  register,
  login,
  verifyLoginOtp,
  forgotPassword,
  resetPassword,
  getUserById,
  updateAdminUser,
};
