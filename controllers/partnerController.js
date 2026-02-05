import db from '../config/db.js';

const TABLE_NAME = 'partners';

const createPartner = async (req, res) => {
    try {
        const b = req.body || {};

        const partner_name = b.partner_name || b.name || null;
        const person_name = b.person_name || b.contact_person || null;
        const email = b.email || b.contact_email || null;
        const phone = b.phone || null;
        const image_url = b.image_url || b.logo || null;
        const branding_config = b.branding_config || (b.branding ? JSON.stringify(b.branding) : null);
        const user_id = b.user_id ? Number(b.user_id) : null;
        const status = b.status || 'Active';

        if (!partner_name || !email) {
            return res.status(400).json({ message: 'Partner name and email are required.' });
        }

        const row = {
            user_id,
            partner_name,
            person_name,
            email,
            phone,
            image_url,
            branding_config,
            status
        };

        const [id] = await db(TABLE_NAME).insert(row);
        const created = await db(TABLE_NAME).where({ id }).first();

        res.status(201).json({ message: 'Partner created successfully', data: created });
    } catch (error) {
        console.error('Create partner error:', error);
        res.status(500).json({ message: 'Failed to create partner', error: error.message });
    }
};

const getPartners = async (req, res) => {
    try {
        const partners = await db(TABLE_NAME).select('*');
        res.json(partners);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch partners', error: error.message });
    }
};

const getPartnerById = async (req, res) => {
    try {
        const { id } = req.params;
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
        if (b.user_id) updates.user_id = Number(b.user_id);
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
        const { id } = req.params;

        const partner = await db(TABLE_NAME).where({ id }).first();
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }

        await db(TABLE_NAME).where({ id }).delete();
        res.json({ message: 'Partner deleted successfully' });
    } catch (error) {
        console.error('Delete partner error:', error);
        res.status(500).json({ message: 'Failed to delete partner', error: error.message });
    }
};

export default {
    createPartner,
    getPartners,
    getPartnerById,
    updatePartner,
    deletePartner
};
