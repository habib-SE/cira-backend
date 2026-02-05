import db from '../config/db.js';

const TABLE_NAME = 'doctor_referrals';

// Helper to handle nulls and extract data safely
const numOrNull = (val) => (val === '' || val === null || val === undefined ? null : Number(val));

const createDoctorReferral = async (req, res) => {
    try {
        const b = req.body || {};

        const user_id = numOrNull(b.user_id || (b.userData && b.userData.id) || null);

        const referral_code = b.referral_code || b.code || `REF-${Date.now()}`;
        const referred_to_doctor_name = b.referred_to_doctor_name || b.doctorName || b.doctor || null;
        const platform = b.platform || 'General';
        const country = b.country || null;

        // Dates/Times
        const referralDateRaw = b.referral_date || b.date || null;
        const referral_date = referralDateRaw ? new Date(referralDateRaw) : null;
        const referral_time = b.referral_time || b.time || null;

        const type = b.type || 'Standard';
        const status = b.status || 'Success';

        const reason = b.reason || null;
        const doctor_notes = b.doctor_notes || b.notes || null;

        // Metadata
        const ip_address = b.ip_address || b.ip || req.ip || null;
        const user_agent = b.user_agent || b.userAgent || req.headers['user-agent'] || null;

        if (!referred_to_doctor_name) {
            return res.status(400).json({ message: 'Referred doctor name is required.' });
        }

        const row = {
            user_id,
            referral_code,
            referred_to_doctor_name,
            platform,
            country,
            referral_date,
            referral_time,
            type,
            status,
            reason,
            doctor_notes,
            ip_address,
            user_agent
        };

        const [id] = await db(TABLE_NAME).insert(row);
        const created = await db(TABLE_NAME).where({ id }).first();

        res.status(201).json({ message: 'Referral created successfully', data: created });
    } catch (error) {
        console.error('Create referral error:', error);
        res.status(500).json({ message: 'Failed to create referral', error: error.message });
    }
};

const getDoctorReferrals = async (req, res) => {
    try {
        const referrals = await db(TABLE_NAME).select('*');
        res.json(referrals);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch referrals', error: error.message });
    }
};

export default {
    createDoctorReferral,
    getDoctorReferrals
};
