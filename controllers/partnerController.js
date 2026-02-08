import db from "../config/db.js";
import bcrypt from "bcrypt";
import { saveBase64ToCloud } from "./ciraCloudcontroller.js";

const TABLE_NAME = "partners";

const isBase64DataUrl = (v) =>
  typeof v === "string" && v.trim().startsWith("data:") && v.includes("base64,");

// ✅ POST /create-partner (protected by requireAuth)
const createPartner = async (req, res) => {
  try {
    const {
      partner_name,
      person_name,
      email,
      phone,
      branding_config,
      status,
      password,
      image_url, // ✅ can be base64 or url
    } = req.body || {};

    // ✅ must be logged in
    const authUserId = req.auth?.id ?? req.auth?.account_id;
    if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

    if (!partner_name || !email || !password) {
      return res.status(400).json({
        message: "partner_name, email and password are required.",
      });
    }

    const emailNorm = String(email).trim().toLowerCase();

    // ✅ duplicate check (case-insensitive)
    const existing = await db(TABLE_NAME)
      .whereRaw("LOWER(email)=?", [emailNorm])
      .first();

    if (existing) {
      return res.status(409).json({
        message: "Partner with this email already exists.",
      });
    }

    // ✅ hash password
    const password_hash = await bcrypt.hash(String(password), 10);

    // ✅ base64 upload
    let storedImageUrl = null;
    if (image_url) {
      if (isBase64DataUrl(image_url)) {
        storedImageUrl = await saveBase64ToCloud(image_url);
      } else {
        storedImageUrl = image_url;
      }
    }

    const row = {
      user_id: authUserId,
      partner_name,
      person_name: person_name || null,
      email: emailNorm,
      phone: phone || null,
      image_url: storedImageUrl,
      branding_config: branding_config || null,
      status: status || "Active",
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

// const createPartner = async (req, res) => {
//     try {
//       const {
//         partner_name,
//         person_name,
//         email,
//         phone,
//         branding_config,
//         status,
//         password,
//         image_url,
//       } = req.body || {};
  
//       // ✅ must be logged in
//       const authUserId = req.auth?.id ?? req.auth?.account_id;
//       if (!authUserId) return res.status(401).json({ message: "Unauthorized." });
  
//       if (!partner_name || !email || !password) {
//         return res.status(400).json({
//           message: "partner_name, email, and password are required.",
//         });
//       }
  
//       const emailNorm = String(email).trim().toLowerCase();
  
//       // ✅ duplicate check (case-insensitive)
//       const existing = await db(TABLE_NAME)
//         .whereRaw("LOWER(email)=?", [emailNorm])
//         .first();
  
//       if (existing) {
//         return res.status(409).json({
//           message: "Partner with this email already exists.",
//         });
//       }
  
//       // ✅ upload base64 image if needed
//       const finalImageUrl = await handleBase64ImageUpload(image_url, "partner");
  
//       // ✅ hash password
//       const password_hash = await bcrypt.hash(String(password), 10);
  
//       const row = {
//         user_id: authUserId,
//         partner_name,
//         person_name: person_name || null,
//         email: emailNorm,
//         phone: phone || null,
//         image_url: finalImageUrl || null,
//         branding_config: branding_config || null,
//         status: status || "Active",
//         role: "partner",
//         password_hash,
//       };
  
//       const [id] = await db(TABLE_NAME).insert(row);
  
//       const created = await db(TABLE_NAME).where({ id }).first();
//       if (created) delete created.password_hash;
  
//       return res.status(201).json({
//         message: "Partner created successfully",
//         data: created,
//       });
//     } catch (error) {
//       console.error("Create partner error:", error);
//       return res.status(500).json({
//         message: "Failed to create partner",
//         error: error.message,
//       });
//     }
//   };
  

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

// const updatePartner = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const b = req.body || {};
//         const authUserId = req.auth?.id ?? req.auth?.account_id;
//         if (!authUserId) return res.status(401).json({ message: "Unauthorized." });
//         const role = String(req.auth?.role || "").toLowerCase();
//         if (role !== "admin") {
//             return res.status(403).json({ message: "Forbidden. Only admin can update companies." });
//         }
//         const partner = await db(TABLE_NAME).where({ id }).first();
//         if (!partner) {
//             return res.status(404).json({ message: 'Partner not found' });
//         }

//         const updates = {};
//         if (b.partner_name || b.name) updates.partner_name = b.partner_name || b.name;
//         if (b.person_name || b.contact_person) updates.person_name = b.person_name || b.contact_person;
//         if (b.email || b.contact_email) updates.email = b.email || b.contact_email;
//         if (b.phone) updates.phone = b.phone;
//         if (b.image_url || b.logo) updates.image_url = b.image_url || b.logo;
//         if (b.branding_config) updates.branding_config = b.branding_config;
//         if (b.branding) updates.branding_config = JSON.stringify(b.branding);
//         if (b.status) updates.status = b.status;

//         await db(TABLE_NAME).where({ id }).update(updates);
//         const updated = await db(TABLE_NAME).where({ id }).first();

//         res.json({ message: 'Partner updated successfully', data: updated });
//     } catch (error) {
//         res.status(500).json({ message: 'Failed to update partner', error: error.message });
//     }
// };


const updatePartner = async (req, res) => {
    try {
      const { id } = req.params;
      const b = req.body || {};
  
      const authUserId = req.auth?.id ?? req.auth?.account_id;
      if (!authUserId) return res.status(401).json({ message: "Unauthorized." });
  
      // ✅ only admin can update
      const role = String(req.auth?.role || "").toLowerCase();
      if (role !== "admin") {
        return res
          .status(403)
          .json({ message: "Forbidden. Only admin can update partners." });
      }
  
      const partner = await db(TABLE_NAME).where({ id }).first();
      if (!partner) return res.status(404).json({ message: "Partner not found" });
  
      const updates = {};
  
      if (b.partner_name || b.name) updates.partner_name = b.partner_name || b.name;
      if (b.person_name || b.contact_person)
        updates.person_name = b.person_name || b.contact_person;
  
      if (b.phone !== undefined) updates.phone = b.phone || null;
      if (b.status) updates.status = b.status;
  
      if (b.branding_config) updates.branding_config = b.branding_config;
      if (b.branding) updates.branding_config = JSON.stringify(b.branding);
  
      // ✅ email update (normalize + prevent duplicates)
      if (b.email || b.contact_email) {
        const emailNorm = String(b.email || b.contact_email).trim().toLowerCase();
  
        const exists = await db(TABLE_NAME)
          .whereRaw("LOWER(email)=?", [emailNorm])
          .andWhereNot({ id })
          .first();
  
        if (exists) {
          return res
            .status(409)
            .json({ message: "Another partner already uses this email." });
        }
  
        updates.email = emailNorm;
      }
  
      // ✅ image_url supports base64
      if (b.image_url || b.logo) {
        const incoming = b.image_url || b.logo;
        if (isBase64DataUrl(incoming)) {
          updates.image_url = await saveBase64ToCloud(incoming);
        } else {
          updates.image_url = incoming;
        }
      }
  
      // ✅ update password_hash if password provided
      if (b.password) {
        updates.password_hash = await bcrypt.hash(String(b.password), 10);
      }
  
      // ✅ force role
      updates.role = "partner";
  
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No fields to update." });
      }
  
      await db(TABLE_NAME).where({ id }).update(updates);
  
      const updated = await db(TABLE_NAME).where({ id }).first();
      if (updated) delete updated.password_hash;
  
      return res.json({ message: "Partner updated successfully", data: updated });
    } catch (error) {
      console.error("Update partner error:", error);
      return res.status(500).json({
        message: "Failed to update partner",
        error: error.message,
      });
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
