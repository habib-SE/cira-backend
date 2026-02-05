import db from '../config/db.js';
import bcrypt from "bcrypt";

const TABLE_NAME = 'companies';



const createCompany = async (req, res) => {
    try {
        const {
            company_name,
            email,
            person_name,
            code,
            phone,
            image_url,
            status,
            password, // ✅ NEW (plain password comes from body)
        } = req.body || {};

        const authUserId = req.auth?.id; // this should be admin user's id
        if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

        if (!company_name || !email || !password) {
            return res.status(400).json({
                message: "company_name, email and password are required.",
            });
        }

        const emailNorm = String(email).trim().toLowerCase();

        // ✅ prevent duplicate company email
        const existing = await db(TABLE_NAME)
            .whereRaw("LOWER(email)=?", [emailNorm])
            .first();

        if (existing) {
            return res.status(409).json({ message: "Company with this email already exists." });
        }

        // ✅ hash password
        const password_hash = await bcrypt.hash(String(password), 10);

        const row = {
            user_id: authUserId,
            company_name,
            code: code || null,
            person_name: person_name || null,
            email: emailNorm,
            phone: phone || null,
            image_url: image_url || null,
            status: status || "Active",
            password_hash, // ✅ NEW
            role: "company", // ✅ optional (if you store role in companies)
        };

        const [id] = await db(TABLE_NAME).insert(row);
        const created = await db(TABLE_NAME).where({ id }).first();

        // ✅ never return password_hash
        if (created) delete created.password_hash;

        return res.status(201).json({
            message: "Company created successfully",
            data: created,
        });
    } catch (error) {
        console.error("Create company error:", error);
        return res.status(500).json({
            message: "Failed to create company",
            error: error.message,
        });
    }
};

const getCompanies = async (req, res) => {
    try {
        const companies = await db(TABLE_NAME).select('*');
        res.json(companies);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch companies', error: error.message });
    }
};

const getCompanyById = async (req, res) => {
    try {
        const { id } = req.params;
        const company = await db(TABLE_NAME).where({ id }).first();
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }
        res.json(company);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch company', error: error.message });
    }
};

const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const b = req.body || {};

        const company = await db(TABLE_NAME).where({ id }).first();
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const updates = {};
        if (b.company_name || b.name) updates.company_name = b.company_name || b.name;
        if (b.email || b.contact_email) updates.email = b.email || b.contact_email;
        if (b.code) updates.code = b.code;
        if (b.person_name || b.contact_person) updates.person_name = b.person_name || b.contact_person;
        if (b.phone) updates.phone = b.phone;
        if (b.image_url || b.logo) updates.image_url = b.image_url || b.logo;
        if (b.user_id) updates.user_id = Number(b.user_id);
        if (b.status) updates.status = b.status;

        await db(TABLE_NAME).where({ id }).update(updates);
        const updated = await db(TABLE_NAME).where({ id }).first();

        res.json({ message: 'Company updated successfully', data: updated });
    } catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({ message: 'Failed to update company', error: error.message });
    }
};

const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;

        const company = await db(TABLE_NAME).where({ id }).first();
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        await db(TABLE_NAME).where({ id }).delete();
        res.json({ message: 'Company deleted successfully' });
    } catch (error) {
        console.error('Delete company error:', error);
        res.status(500).json({ message: 'Failed to delete company', error: error.message });
    }
};

export default {
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany
};
