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

// const updatePartnerProfile = async (req, res) => {
//   try {
//     const { partner_name, person_name, email, phone, branding_config, status, image_url, password } = req.body || {};
//     const { id } = req.params; // Partner ID to update

//     // ✅ Ensure the partner is logged in
//     const authUserId = req.auth?.id ?? req.auth?.account_id;
//     if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

//     // Only allow the partner to update their own profile
//     if (authUserId !== Number(id)) {
//       return res.status(403).json({ message: "Forbidden. You cannot update this partner." });
//     }

//     // Prepare the update object
//     const updates = {};

//     if (partner_name) updates.partner_name = partner_name;
//     if (person_name) updates.person_name = person_name;
//     if (phone) updates.phone = phone;
//     if (branding_config) updates.branding_config = branding_config;
//     if (status) updates.status = status;
//     if (email) {
//       const emailNorm = String(email).trim().toLowerCase();
//       const existingPartner = await db(TABLE_NAME).whereRaw("LOWER(email)=LOWER(?)", [emailNorm]).first();
//       if (existingPartner && existingPartner.id !== id) {
//         return res.status(400).json({ message: "Email is already taken by another partner." });
//       }
//       updates.email = emailNorm;
//     }

//     // Handle password update (optional)
//     if (password) {
//       const password_hash = await bcrypt.hash(String(password), 10);
//       updates.password_hash = password_hash;
//     }

//     // Handle image_url (base64 or URL)
//     if (image_url) {
//       let storedImageUrl = null;
//       if (isBase64DataUrl(image_url)) {
//         storedImageUrl = await saveBase64ToCloud(image_url); // Upload to cloud
//       } else {
//         storedImageUrl = image_url; // Keep as URL
//       }
//       updates.image_url = storedImageUrl;
//     }

//     // If no valid fields to update, return error
//     if (!Object.keys(updates).length) {
//       return res.status(400).json({ message: "No fields to update." });
//     }

//     // Update the partner in the database
//     await db(TABLE_NAME).where({ id }).update(updates);
//     const updatedPartner = await db(TABLE_NAME).where({ id }).first();

//     // Remove password hash before returning response
//     if (updatedPartner) delete updatedPartner.password_hash;

//     return res.status(200).json({ message: "Partner profile updated successfully", data: updatedPartner });
//   } catch (error) {
//     console.error("Update partner profile error:", error);
//     return res.status(500).json({ message: "Failed to update partner profile", error: error.message });
//   }
// };
const updatePartnerProfile = async (req, res) => {
  try {
    const { partner_name, person_name, email, phone, status, password, image_url, branding } = req.body || {};
    const { id } = req.params; // Partner ID to update

    // ✅ Ensure the partner is logged in
    const authUserId = req.auth?.id ?? req.auth?.account_id;
    if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

    // Only allow the partner to update their own profile
    if (authUserId !== Number(id)) {
      return res.status(403).json({ message: "Forbidden. You cannot update this partner." });
    }

    // Prepare the update object
    const updates = {};

    if (partner_name) updates.partner_name = partner_name;
    if (person_name) updates.person_name = person_name;
    if (phone) updates.phone = phone;
    if (status) updates.status = status;

    // Handle email update (check if it's already taken by another partner)
    if (email) {
      const emailNorm = String(email).trim().toLowerCase();
      const existingPartner = await db(TABLE_NAME).whereRaw("LOWER(email)=LOWER(?)", [emailNorm]).first();
      if (existingPartner && existingPartner.id !== id) {
        return res.status(400).json({ message: "Email is already taken by another partner." });
      }
      updates.email = emailNorm;
    }

    // Handle password update (optional)
    if (password) {
      const password_hash = await bcrypt.hash(String(password), 10);
      updates.password_hash = password_hash;
    }

    // Handle branding update (if provided)
    if (branding) {
      // Flatten branding config if it's provided
      if (branding.primaryColor || branding.secondaryColor) {
        updates.branding_config = JSON.stringify(branding); // Store as JSON
      }
    }

    // Handle image_url (base64 or URL)
    if (image_url) {
      let storedImageUrl = null;
      if (isBase64DataUrl(image_url)) {
        storedImageUrl = await saveBase64ToCloud(image_url); // Upload to cloud if base64
      } else {
        storedImageUrl = image_url; // Keep as URL if not base64
      }
      updates.image_url = storedImageUrl;
    }

    // If no valid fields to update, return error
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }

    // Update the partner in the database
    await db(TABLE_NAME).where({ id }).update(updates);
    const updatedPartner = await db(TABLE_NAME).where({ id }).first();

    // Remove password hash before returning response
    if (updatedPartner) delete updatedPartner.password_hash;

    return res.status(200).json({ message: "Partner profile updated successfully", data: updatedPartner });
  } catch (error) {
    console.error("Update partner profile error:", error);
    return res.status(500).json({ message: "Failed to update partner profile", error: error.message });
  }
};


const getPartnerProfile = async (req, res) => {
  try {
    const { id } = req.params; // Partner ID to fetch

    // ✅ Ensure the partner is logged in
    const authUserId = req.auth?.id ?? req.auth?.account_id;
    if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

    // Only allow the partner to view their own profile
    if (authUserId !== Number(id)) {
      return res.status(403).json({ message: "Forbidden. You cannot view this partner's profile." });
    }

    // Retrieve the partner data from the database based on partnerId
    const partner = await db(TABLE_NAME).where({ id }).first();

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Remove password hash before sending the response
    delete partner.password_hash;

    return res.status(200).json({ message: "Partner profile retrieved successfully", data: partner });
  } catch (error) {
    console.error("Fetch partner profile error:", error);
    return res.status(500).json({ message: "Failed to fetch partner profile", error: error.message });
  }
};

export default {
    createPartner,
    getPartners,
    getPartnerById,
    updatePartner,
    deletePartner,
    getPartnerProfile,
    updatePartnerProfile
};
