import db from "../config/db.js";
import bcrypt from "bcrypt";

const TABLE_NAME = "employees";

// ✅ helper: must be logged in
const ensureAuth = (req, res) => {
  const authUserId = req.auth?.id;
  if (!authUserId) {
    res.status(401).json({ message: "Unauthorized." });
    return null;
  }
  return { authUserId, authRole: req.auth?.role };
};

const createEmployee = async (req, res) => {
  const auth = ensureAuth(req, res);
  if (!auth) return;

  try {
    const b = req.body || {};

    const company_id = b.company_id ? Number(b.company_id) : null;
    const user_id = b.user_id ? Number(b.user_id) : null;
    const employee_name = b.employee_name || b.name || null;
    const email = b.email || null;
    const password = b.password || null;
    const image_url = b.image_url || b.avatar || null;
    const status = b.status || "Active";

    if (!company_id || !employee_name || !email || !password) {
      return res.status(400).json({
        message: "Company ID, Employee Name, Email, and Password are required.",
      });
    }

    // (optional) avoid duplicate employee email in same company
    const exists = await db(TABLE_NAME)
      .whereRaw("LOWER(email)=LOWER(?)", [String(email).trim()])
      .where({ company_id })
      .first();

    if (exists) {
      return res.status(400).json({ message: "Employee with this email already exists in this company." });
    }

    const password_hash = await bcrypt.hash(String(password), 10);

    const row = {
      company_id,
      user_id,
      employee_name,
      email: String(email).trim(),
      password_hash,
      image_url,
      status,
    };

    const [id] = await db(TABLE_NAME).insert(row);
    const created = await db(TABLE_NAME).where({ id }).first();

    return res.status(201).json({ message: "Employee created successfully", data: created });
  } catch (error) {
    console.error("Create employee error:", error);
    return res.status(500).json({ message: "Failed to create employee", error: error.message });
  }
};

const getEmployees = async (req, res) => {
  const auth = ensureAuth(req, res);
  if (!auth) return;

  try {
    const { company_id } = req.query;

    let query = db(TABLE_NAME).select("*");

    if (company_id) {
      query = query.where({ company_id: Number(company_id) });
    }

    const employees = await query;
    return res.json(employees);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch employees", error: error.message });
  }
};

const getEmployeeById = async (req, res) => {
  const auth = ensureAuth(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;
    const employee = await db(TABLE_NAME).where({ id: Number(id) }).first();

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    return res.json(employee);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch employee", error: error.message });
  }
};

const updateEmployee = async (req, res) => {
  const auth = ensureAuth(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;
    const b = req.body || {};

    const employee = await db(TABLE_NAME).where({ id: Number(id) }).first();
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const updates = {};

    if (b.company_id) updates.company_id = Number(b.company_id);
    if (b.user_id) updates.user_id = Number(b.user_id);
    if (b.employee_name || b.name) updates.employee_name = b.employee_name || b.name;
    if (b.email) updates.email = String(b.email).trim();
    if (b.image_url || b.avatar) updates.image_url = b.image_url || b.avatar;
    if (b.status) updates.status = b.status;

    // ✅ allow password update too (optional)
    if (b.password) {
      updates.password_hash = await bcrypt.hash(String(b.password), 10);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No valid fields to update." });
    }

    await db(TABLE_NAME).where({ id: Number(id) }).update(updates);
    const updated = await db(TABLE_NAME).where({ id: Number(id) }).first();

    return res.json({ message: "Employee updated successfully", data: updated });
  } catch (error) {
    console.error("Update employee error:", error);
    return res.status(500).json({ message: "Failed to update employee", error: error.message });
  }
};

const deleteEmployee = async (req, res) => {
  const auth = ensureAuth(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;

    const employee = await db(TABLE_NAME).where({ id: Number(id) }).first();
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    await db(TABLE_NAME).where({ id: Number(id) }).delete();
    return res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Delete employee error:", error);
    return res.status(500).json({ message: "Failed to delete employee", error: error.message });
  }
};

export default {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};
