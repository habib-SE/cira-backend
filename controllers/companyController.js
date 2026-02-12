import db from "../config/db.js";
import bcrypt from "bcrypt";
import { saveBase64ToCloud } from "./ciraCloudcontroller.js";

const TABLE_NAME = "companies";

const isBase64DataUrl = (v) =>
  typeof v === "string" && v.trim().startsWith("data:") && v.includes("base64,");



// const createCompany = async (req, res) => {
//     try {
//         const {
//             company_name,
//             email,
//             person_name,
//             code,
//             phone,
//             image_url,
//             status,
//             password, // ✅ NEW (plain password comes from body)
//         } = req.body || {};

//         const authUserId = req.auth?.id; // this should be admin user's id
//         if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

//         if (!company_name || !email || !password) {
//             return res.status(400).json({
//                 message: "company_name, email and password are required.",
//             });
//         }

//         const emailNorm = String(email).trim().toLowerCase();

//         // ✅ prevent duplicate company email
//         const existing = await db(TABLE_NAME)
//             .whereRaw("LOWER(email)=?", [emailNorm])
//             .first();

//         if (existing) {
//             return res.status(409).json({ message: "Company with this email already exists." });
//         }

//         // ✅ hash password
//         const password_hash = await bcrypt.hash(String(password), 10);

//         const row = {
//             user_id: authUserId,
//             company_name,
//             code: code || null,
//             person_name: person_name || null,
//             email: emailNorm,
//             phone: phone || null,
//             image_url: image_url || null,
//             status: status || "Active",
//             password_hash, // ✅ NEW
//             role: "company", // ✅ optional (if you store role in companies)
//         };

//         const [id] = await db(TABLE_NAME).insert(row);
//         const created = await db(TABLE_NAME).where({ id }).first();

//         // ✅ never return password_hash
//         if (created) delete created.password_hash;

//         return res.status(201).json({
//             message: "Company created successfully",
//             data: created,
//         });
//     } catch (error) {
//         console.error("Create company error:", error);
//         return res.status(500).json({
//             message: "Failed to create company",
//             error: error.message,
//         });
//     }
// };


const createCompany = async (req, res) => {
    try {
      const {
        company_name,
        email,
        person_name,
        code,
        employees_count,
        phone,
        image_url, // ✅ can be normal URL OR base64
        status,
        password,
      } = req.body || {};
  
      const authUserId = req.auth?.id;
      if (!authUserId) return res.status(401).json({ message: "Unauthorized." });
  
      if (!company_name || !email || !password) {
        return res.status(400).json({
          message: "company_name, email and password are required.",
        });
      }
  
      const emailNorm = String(email).trim().toLowerCase();
  
      // ✅ prevent duplicate email
      const existing = await db(TABLE_NAME)
        .whereRaw("LOWER(email)=?", [emailNorm])
        .first();
  
      if (existing) {
        return res
          .status(409)
          .json({ message: "Company with this email already exists." });
      }
  
      // ✅ hash password
      const password_hash = await bcrypt.hash(String(password), 10);
  
      // ✅ if image_url is base64 -> upload to cira-cloud -> get URL
      let storedImageUrl = null;
      if (image_url) {
        if (isBase64DataUrl(image_url)) {
          storedImageUrl = await saveBase64ToCloud(image_url); // ✅ returns /cira-cloud/file...
        } else {
          storedImageUrl = image_url; // already url
        }
      }
  
      const row = {
        user_id: authUserId,
        company_name,
        code: code || null,
        person_name: person_name || null,
        email: emailNorm,
        phone: phone || null,
        image_url: storedImageUrl,
        employees_count: employees_count || 0,
        status: status || "Active",
        password_hash,
        role: "company",
      };
  
      const [id] = await db(TABLE_NAME).insert(row);
      const created = await db(TABLE_NAME).where({ id }).first();
  
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
        // ✅ must be logged in
        const authUserId = req.auth?.id ?? req.auth?.account_id;
        if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

        const companies = await db(TABLE_NAME).select("*");
        return res.json(companies);
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch companies",
            error: error.message,
        });
    }
};



const getCompanyById = async (req, res) => {
    try {
        const authUserId = req.auth?.id ?? req.auth?.account_id;
        if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

        const { id } = req.params;

        const company = await db(TABLE_NAME).where({ id }).first();
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        return res.json(company);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch company", error: error.message });
    }
};

// const updateCompany = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const b = req.body || {};

//         // ✅ must be logged in
//         const authUserId = req.auth?.id ?? req.auth?.account_id;
//         if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

//         // ✅ OPTIONAL (recommended): only admin can update companies
//         const role = String(req.auth?.role || "").toLowerCase();
//         if (role !== "admin") {
//             return res.status(403).json({ message: "Forbidden. Only admin can update companies." });
//         }

//         const company = await db(TABLE_NAME).where({ id }).first();
//         if (!company) {
//             return res.status(404).json({ message: "Company not found" });
//         }

//         const updates = {};

//         if (b.company_name || b.name) updates.company_name = b.company_name || b.name;
//         if (b.code !== undefined) updates.code = b.code || null;
//         if (b.person_name || b.contact_person)
//             updates.person_name = b.person_name || b.contact_person;

//         if (b.phone !== undefined) updates.phone = b.phone || null;
//         if (b.image_url || b.logo) updates.image_url = b.image_url || b.logo;
//         if (b.status) updates.status = b.status;

//         // ✅ Force role (don’t trust frontend)
//         updates.role = "company";

//         // ✅ update email safely + normalize + prevent duplicates
//         if (b.email || b.contact_email) {
//             const emailNorm = String(b.email || b.contact_email).trim().toLowerCase();

//             const exists = await db(TABLE_NAME)
//                 .whereRaw("LOWER(email)=?", [emailNorm])
//                 .andWhereNot({ id })
//                 .first();

//             if (exists) {
//                 return res.status(409).json({ message: "Another company already uses this email." });
//             }

//             updates.email = emailNorm;
//         }

//         // ✅ update password_hash if password provided
//         if (b.password) {
//             updates.password_hash = await bcrypt.hash(String(b.password), 10);
//         }

//         if (Object.keys(updates).length === 0) {
//             return res.status(400).json({ message: "No fields to update." });
//         }

//         await db(TABLE_NAME).where({ id }).update(updates);

//         const updated = await db(TABLE_NAME).where({ id }).first();
//         if (updated) delete updated.password_hash;

//         return res.json({ message: "Company updated successfully", data: updated });
//     } catch (error) {
//         console.error("Update company error:", error);
//         return res.status(500).json({
//             message: "Failed to update company",
//             error: error.message,
//         });
//     }
// };
// const updateCompany = async (req, res) => {
//     try {
//       const { id } = req.params;
//       const b = req.body || {};
  
//       const authUserId = req.auth?.id ?? req.auth?.account_id;
//       if (!authUserId) return res.status(401).json({ message: "Unauthorized." });
  
//       // ✅ only admin can update
//       const role = String(req.auth?.role || "").toLowerCase();
//       if (role !== "admin") {
//         return res
//           .status(403)
//           .json({ message: "Forbidden. Only admin can update companies." });
//       }
  
//       const company = await db(TABLE_NAME).where({ id }).first();
//       if (!company) {
//         return res.status(404).json({ message: "Company not found" });
//       }
  
//       const updates = {};
  
//       if (b.company_name || b.name) updates.company_name = b.company_name || b.name;
//       if (b.code !== undefined) updates.code = b.code || null;
//       if (b.person_name || b.contact_person)
//         updates.person_name = b.person_name || b.contact_person;
//       if (b.phone !== undefined) updates.phone = b.phone || null;
//       if (b.status) updates.status = b.status;
  
//       // ✅ image_url supports base64
//       if (b.image_url || b.logo) {
//         const incoming = b.image_url || b.logo;
//         if (isBase64DataUrl(incoming)) {
//           updates.image_url = await saveBase64ToCloud(incoming);
//         } else {
//           updates.image_url = incoming;
//         }
//       }
  
//       // ✅ force role
//       updates.role = "company";
  
//       // ✅ update email
//       if (b.email || b.contact_email) {
//         const emailNorm = String(b.email || b.contact_email).trim().toLowerCase();
  
//         const exists = await db(TABLE_NAME)
//           .whereRaw("LOWER(email)=?", [emailNorm])
//           .andWhereNot({ id })
//           .first();
  
//         if (exists) {
//           return res
//             .status(409)
//             .json({ message: "Another company already uses this email." });
//         }
  
//         updates.email = emailNorm;
//       }
  
//       // ✅ update password_hash
//       if (b.password) {
//         updates.password_hash = await bcrypt.hash(String(b.password), 10);
//       }
  
//       if (Object.keys(updates).length === 0) {
//         return res.status(400).json({ message: "No fields to update." });
//       }
  
//       await db(TABLE_NAME).where({ id }).update(updates);
  
//       const updated = await db(TABLE_NAME).where({ id }).first();
//       if (updated) delete updated.password_hash;
  
//       return res.json({ message: "Company updated successfully", data: updated });
//     } catch (error) {
//       console.error("Update company error:", error);
//       return res.status(500).json({
//         message: "Failed to update company",
//         error: error.message,
//       });
//     }
//   };
  

const updateCompany = async (req, res) => {
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
        .json({ message: "Forbidden. Only admin can update companies." });
    }

    const company = await db(TABLE_NAME).where({ id }).first();
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const updates = {};

    if (b.company_name || b.name) updates.company_name = b.company_name || b.name;
    if (b.code !== undefined) updates.code = b.code || null;
    if (b.person_name || b.contact_person)
      updates.person_name = b.person_name || b.contact_person;
    if (b.phone !== undefined) updates.phone = b.phone || null;
    if (b.status) updates.status = b.status;

    // ✅ Add handling for employees_count
    if (b.employees_count !== undefined) {
      const employeesCount = Number(b.employees_count);
      if (!isNaN(employeesCount) && employeesCount >= 0) {
        updates.employees_count = employeesCount;
      } else {
        return res.status(400).json({ message: "Invalid employees_count value" });
      }
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

    // ✅ force role
    updates.role = "company";

    // ✅ update email
    if (b.email || b.contact_email) {
      const emailNorm = String(b.email || b.contact_email).trim().toLowerCase();

      const exists = await db(TABLE_NAME)
        .whereRaw("LOWER(email)=?", [emailNorm])
        .andWhereNot({ id })
        .first();

      if (exists) {
        return res
          .status(409)
          .json({ message: "Another company already uses this email." });
      }

      updates.email = emailNorm;
    }

    // ✅ update password_hash
    if (b.password) {
      updates.password_hash = await bcrypt.hash(String(b.password), 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }

    await db(TABLE_NAME).where({ id }).update(updates);

    const updated = await db(TABLE_NAME).where({ id }).first();
    if (updated) delete updated.password_hash;

    return res.json({ message: "Company updated successfully", data: updated });
  } catch (error) {
    console.error("Update company error:", error);
    return res.status(500).json({
      message: "Failed to update company",
      error: error.message,
    });
  }
};

const deleteCompany = async (req, res) => {
    try {
        const authUserId = req.auth?.id ?? req.auth?.account_id;
        if (!authUserId) return res.status(401).json({ message: "Unauthorized." });

        const { id } = req.params;

        const company = await db(TABLE_NAME).where({ id }).first();
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        await db(TABLE_NAME).where({ id }).delete();
        res.json({ message: "Company deleted successfully" });
    } catch (error) {
        console.error("Delete company error:", error);
        res.status(500).json({ message: "Failed to delete company", error: error.message });
    }
};


export default {
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany
};
