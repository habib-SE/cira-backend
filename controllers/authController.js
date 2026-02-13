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

const updateAdminUser = async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone, image_url } = req.body;
    const { id } = req.params;  // Admin user ID to update

    // Ensure the user is logged in and is an admin
    const authUserId = req.auth?.id;
    const authRole = req.auth?.role;
    
    if (!authUserId || authRole !== 'admin') {
      return res.status(401).json({ message: 'Unauthorized. Only admins can update their profile.' });
    }

    // Only allow the admin to update their own profile
    if (authUserId !== Number(id)) {
      return res.status(403).json({ message: "Forbidden. You can't update this user." });
    }

    // Prepare the update object
    const updates = {};

    if (first_name) updates.first_name = first_name;
    if (last_name) updates.last_name = last_name;
    if (phone) updates.phone = phone;
    if (image_url) updates.image_url = image_url;

    // Prevent email conflicts (check if the new email is already taken by another admin or user)
    if (email) {
      const existingUser = await db(TABLE_NAME).whereRaw("LOWER(email)=LOWER(?)", [email]).first();
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ message: 'Email is already taken by another user.' });
      }
      updates.email = email;
    }

    // Handle password update (optional)
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updates.password_hash = password_hash;
    }

    // If no updates were provided, return an error
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    // Update the user in the database
    await db(TABLE_NAME).where({ id }).update(updates);
    const updatedUser = await db(TABLE_NAME).where({ id }).first();

    // Remove password_hash before returning the response
    if (updatedUser) delete updatedUser.password_hash;

    return res.status(200).json({ message: 'User profile updated successfully', data: updatedUser });
  } catch (error) {
    console.error('Update admin user error:', error);
    return res.status(500).json({ message: 'Failed to update user profile', error: error.message });
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



export default {
  register,
  login,
  verifyLoginOtp,
  forgotPassword,
  resetPassword,
  getUserById,
  updateAdminUser,
};
