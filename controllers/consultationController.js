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

    // Accept all fields from the frontend payload
    const {
      patient_name,
      age,
      biological_sex,
      pathway, // Added this field
      reason,
      doctor_notes,
      duration_minutes,
      type = "OPC",
      status = "Pending",
      consultation_date = new Date().toISOString().split('T')[0],
      consultation_time = null,
      // Add any other fields from your payload
    } = req.body || {};

    // Basic validation
    if (!patient_name) {
      return res.status(400).json({ message: "patient_name is required." });
    }

    // Parse date
    const parsedDate = new Date(consultation_date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "consultation_date is invalid." });
    }

    // Create row for database
    const row = {
      user_id,
      consultation_code: `CONS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patient_name: String(patient_name).trim(),
      age: numOrNull(age ?? null),
      biological_sex: biological_sex || null,
      // Store pathway as a JSON field or in a separate column if needed
      pathway_data: pathway ? JSON.stringify({ pathway }) : null,
      reason: reason || null,
      doctor_notes: doctor_notes || null,
      duration_minutes: numOrNull(duration_minutes ?? null),
      type: type,
      status: status,
      consultation_date: parsedDate,
      consultation_time: consultation_time,
      ip_address: req.ip || null,
      user_agent: req.headers["user-agent"] || null,
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
