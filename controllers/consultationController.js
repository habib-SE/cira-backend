import db from '../config/db.js';

const TABLE_NAME = 'consultations';

// Helper to handle nulls and extract data safely
const numOrNull = (val) => (val === '' || val === null || val === undefined ? null : Number(val));

const createConsultation = async (req, res) => {
    try {
        const b = req.body || {};

        const user_id = numOrNull(b.user_id || (b.userData && b.userData.id) || null);

        // Mapping payload to schema
        const patient_name = b.patient_name || b.patientName || (b.userData && (b.userData.name || b.userData.userName)) || null;
        const age = numOrNull(b.age || (b.userData && b.userData.age) || null);

        // Dates/Times
        const consultDateRaw = b.consultation_date || b.date || null;
        const consultation_date = consultDateRaw ? new Date(consultDateRaw) : null;
        const consultation_time = b.consultation_time || b.time || null; // Expected 'HH:MM:SS'

        const duration_minutes = numOrNull(b.duration_minutes || b.duration || null);

        const type = b.type || b.consultationType || 'OPC';
        const status = b.status || 'Pending';
        const consultation_code = b.consultation_code || b.code || `CONS-${Date.now()}`;

        const reason = b.reason || b.symptoms || null;
        const doctor_notes = b.doctor_notes || b.notes || null;

        // Metadata
        const ip_address = b.ip_address || b.ip || req.ip || null;
        const user_agent = b.user_agent || b.userAgent || req.headers['user-agent'] || null;

        const row = {
            user_id,
            consultation_code,
            patient_name,
            age,
            consultation_date,
            consultation_time,
            duration_minutes,
            type,
            status,
            reason,
            doctor_notes,
            ip_address,
            user_agent
        };

        const [id] = await db(TABLE_NAME).insert(row);
        const created = await db(TABLE_NAME).where({ id }).first();

        res.status(201).json({ message: 'Consultation created successfully', data: created });
    } catch (error) {
        console.error('Create consultation error:', error);
        res.status(500).json({ message: 'Failed to create consultation', error: error.message });
    }
};

const getConsultations = async (req, res) => {
    try {
        const { user_id } = req.query;
        let query = db(TABLE_NAME).select('*');
        if (user_id) {
            query = query.where({ user_id });
        }
        const consultations = await query;
        res.json(consultations);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch consultations', error: error.message });
    }
};

export default {
    createConsultation,
    getConsultations
};
