import db from "../config/db.js";
import bcrypt from "bcrypt";

const TABLE_NAME = 'partners';


// ✅ POST /create-partner  (protected by requireAuth)
const createPartner = async (req, res) => {
    try {
        const { partner_name, person_name, email, phone, branding_config, status, password, image_url } = req.body || {};

        // ✅ created-by user must be logged in
        const authUserId = req.auth?.id ?? req.auth?.account_id;
        if (!authUserId) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        // ✅ duplicate check (case-insensitive)
        const existing = await db(TABLE_NAME)
            .whereRaw("LOWER(email) = ?", [email])
            .first();

        if (existing) {
            return res.status(409).json({
                message: "Partner with this email already exists.",
            });
        }

        // ✅ hash password
        const password_hash = await bcrypt.hash(String(password), 10);

        // ✅ FORCE role; do not trust frontend
        const row = {
            user_id: authUserId,
            partner_name,
            person_name,
            email,
            phone,
            image_url,
            branding_config,
            status,
            role: "partner",
            password_hash,
        };

        const [id] = await db(TABLE_NAME).insert(row);

        const created = await db(TABLE_NAME).where({ id }).first();
        if (created) delete created.password_hash;

        return res.status(201).json({
            message: "Partner created successfully",
            data: created,
        });
    } catch (error) {
        console.error("Create partner error:", error);
        return res.status(500).json({
            message: "Failed to create partner",
            error: error.message,
        });
    }
};


const getPartners = async (req, res) => {
    try {
        const authUserId = req.auth?.id ?? req.auth?.account_id;
        if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

        const partners = await db(TABLE_NAME).select('*');
        res.json(partners);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch partners', error: error.message });
    }
};

const getPartnerById = async (req, res) => {
    try {
        const { id } = req.params;
        const authUserId = req.auth?.id ?? req.auth?.account_id;
        if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

        const partner = await db(TABLE_NAME).where({ id }).first();
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }
        res.json(partner);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch partner', error: error.message });
    }
};

const updatePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const b = req.body || {};
        const authUserId = req.auth?.id ?? req.auth?.account_id;
        if (!authUserId) return res.status(401).json({ message: "Unauthorized." });
        const role = String(req.auth?.role || "").toLowerCase();
        if (role !== "admin") {
            return res.status(403).json({ message: "Forbidden. Only admin can update companies." });
        }
        const partner = await db(TABLE_NAME).where({ id }).first();
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }

        const updates = {};
        if (b.partner_name || b.name) updates.partner_name = b.partner_name || b.name;
        if (b.person_name || b.contact_person) updates.person_name = b.person_name || b.contact_person;
        if (b.email || b.contact_email) updates.email = b.email || b.contact_email;
        if (b.phone) updates.phone = b.phone;
        if (b.image_url || b.logo) updates.image_url = b.image_url || b.logo;
        if (b.branding_config) updates.branding_config = b.branding_config;
        if (b.branding) updates.branding_config = JSON.stringify(b.branding);
        if (b.status) updates.status = b.status;

        await db(TABLE_NAME).where({ id }).update(updates);
        const updated = await db(TABLE_NAME).where({ id }).first();

        res.json({ message: 'Partner updated successfully', data: updated });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update partner', error: error.message });
    }
};

const deletePartner = async (req, res) => {
  try {
    const authUserId = req.auth?.id ?? req.auth?.account_id;
    if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid partner id." });
    }

    const deletedCount = await db(TABLE_NAME).where({ id }).del();

    if (!deletedCount) {
      return res.status(404).json({ message: "Partner not found" });
    }

    return res.json({ message: "Partner deleted successfully" });
  } catch (error) {
    console.error("Delete partner error:", error);
    return res.status(500).json({
      message: "Failed to delete partner",
      error: error.message,
    });
  }
};


export default {
    createPartner,
    getPartners,
    getPartnerById,
    updatePartner,
    deletePartner
};
