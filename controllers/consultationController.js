import db from '../config/db.js';

const TABLE_NAME = 'consultations';

// Helper to handle nulls and extract data safely
const numOrNull = (val) => (val === '' || val === null || val === undefined ? null : Number(val));
const createConsultation = async (req, res) => {
  try {
    const user_id = numOrNull(req.params?.user_id ?? null);
    if (!user_id) {
      return res.status(400).json({ message: "user_id is required in params (:user_id)." });
    }

    // ✅ only table-related variables (same style)
    const {
      consultation_code,
      patient_name,
      age,
      biological_sex,
      consultation_date,
      consultation_time,
      duration_minutes,
      type,
      status,
      reason,
      doctor_notes,
      ip_address,
      user_agent,
    } = req.body || {};

    // ✅ basic required checks
    if (!patient_name) {
      return res.status(400).json({ message: "patient_name is required." });
    }

    if (!consultation_date) {
      return res.status(400).json({ message: "consultation_date is required." });
    }

    // ✅ safe date parse
    const parsedDate = new Date(consultation_date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "consultation_date is invalid." });
    }

    // ✅ time normalize (HH:MM -> HH:MM:SS)
    let finalTime = consultation_time ? String(consultation_time).trim() : null;
    if (finalTime && /^\d{2}:\d{2}$/.test(finalTime)) finalTime = `${finalTime}:00`;
    if (finalTime && !/^\d{2}:\d{2}:\d{2}$/.test(finalTime)) {
      return res.status(400).json({ message: "consultation_time must be HH:MM:SS." });
    }

    const row = {
      user_id,
      consultation_code: consultation_code || `CONS-${Date.now()}`,
      patient_name: String(patient_name).trim(),
      age: numOrNull(age ?? null),
      biological_sex: biological_sex || null,
      consultation_date: parsedDate,
      consultation_time: finalTime,
      duration_minutes: numOrNull(duration_minutes ?? null),
      type: type || "OPC",
      status: status || "Pending",
      reason: reason || null,
      doctor_notes: doctor_notes || null,
      ip_address: ip_address || req.ip || null,
      user_agent: user_agent || req.headers["user-agent"] || null,
      // created_at will be auto (if DB default exists)
    };

    const [id] = await db(TABLE_NAME).insert(row);
    const created = await db(TABLE_NAME).where({ id }).first();

    return res.status(201).json({
      message: "Consultation created successfully",
      data: created,
    });
  } catch (error) {
    console.error("Create consultation error:", error);
    return res.status(500).json({
      message: "Failed to create consultation",
      error: error.message,
    });
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
