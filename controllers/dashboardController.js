import db from "../config/db.js";

const TABLES = {
  companies: "companies",
  partners: "partners",
  employees: "employees",
  consultations: "consultations",
  doctorReferrals: "doctor_referrals",
};

// last 12 months labels: ["2025-02", ...]
function lastNMonths(n = 12) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const m = String(x.getMonth() + 1).padStart(2, "0");
    out.push(`${x.getFullYear()}-${m}`);
  }
  return out;
}

export const getDashboardSummary = async (req, res) => {
  try {
    const authUserId = req.auth?.id;
    const authRole = req.auth?.role;

    if (!authUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const months = lastNMonths(12);

    // helper to build chart points from two monthly maps
    const buildPoints = (consRows, refRows) => {
      const consMap = new Map(consRows.map((r) => [r.month, Number(r.total || 0)]));
      const refMap = new Map(refRows.map((r) => [r.month, Number(r.total || 0)]));
      return months.map((m) => ({
        month: m,
        consultations: consMap.get(m) || 0,
        doctorsReferred: refMap.get(m) || 0,
      }));
    };

    // ---------------------------
    // ADMIN DASHBOARD
    // ---------------------------
    if (authRole === "admin") {
      const [companiesRow, partnersRow, consultationsRow, doctorReferralsRow] =
        await Promise.all([
          db(TABLES.companies).count({ c: "*" }).first(),
          db(TABLES.partners).count({ c: "*" }).first(),
          db(TABLES.consultations).count({ c: "*" }).first(),
          db(TABLES.doctorReferrals).count({ c: "*" }).first(),
        ]);

      const consultationsByMonth = await db(TABLES.consultations)
        .select(db.raw("DATE_FORMAT(created_at, '%Y-%m') as month"))
        .count({ total: "*" })
        .whereRaw("created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)")
        .groupBy("month");

      const referralsByMonth = await db(TABLES.doctorReferrals)
        .select(db.raw("DATE_FORMAT(created_at, '%Y-%m') as month"))
        .count({ total: "*" })
        .whereRaw("created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)")
        .groupBy("month");

      return res.json({
        success: true,
        message: "Dashboard summary fetched successfully",
        data: {
          cards: {
            totalCompanies: Number(companiesRow?.c || 0),
            totalPartners: Number(partnersRow?.c || 0),
            totalConsultations: Number(consultationsRow?.c || 0),
            totalDoctorsReferred: Number(doctorReferralsRow?.c || 0),
          },
          chart: {
            type: "2d_line",
            xAxisKey: "month",
            series: [
              { key: "consultations", label: "Consultations" },
              { key: "doctorsReferred", label: "Doctors Referred" },
            ],
            points: buildPoints(consultationsByMonth, referralsByMonth),
          },
        },
      });
    }

    // ---------------------------
    // COMPANY DASHBOARD
    // ---------------------------
    if (authRole === "company") {
      // ✅ find company by logged-in user_id
      const company = await db(TABLES.companies).where({ user_id: authUserId }).first();
      if (!company) {
        return res.status(404).json({ success: false, message: "Company not found for this user." });
      }

      const companyId = company.id;

      const [employeesRow, consultationsRow, doctorReferralsRow] = await Promise.all([
        db(TABLES.employees).where({ company_id: companyId }).count({ c: "*" }).first(),

        // 👇 assumes consultations.company_id exists
        db(TABLES.consultations).where({ company_id: companyId }).count({ c: "*" }).first(),

        // 👇 assumes doctor_referrals.company_id exists
        db(TABLES.doctorReferrals).where({ company_id: companyId }).count({ c: "*" }).first(),
      ]);

      const consultationsByMonth = await db(TABLES.consultations)
        .select(db.raw("DATE_FORMAT(created_at, '%Y-%m') as month"))
        .count({ total: "*" })
        .where({ company_id: companyId })
        .whereRaw("created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)")
        .groupBy("month");

      const referralsByMonth = await db(TABLES.doctorReferrals)
        .select(db.raw("DATE_FORMAT(created_at, '%Y-%m') as month"))
        .count({ total: "*" })
        .where({ company_id: companyId })
        .whereRaw("created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)")
        .groupBy("month");

      return res.json({
        success: true,
        message: "Company Dashboard summary fetched successfully",
        data: {
          cards: {
            totalEmployees: Number(employeesRow?.c || 0),
            totalConsultations: Number(consultationsRow?.c || 0),
            totalDoctorsReferred: Number(doctorReferralsRow?.c || 0),
          },
          chart: {
            type: "2d_line",
            xAxisKey: "month",
            series: [
              { key: "consultations", label: "Consultations" },
              { key: "doctorsReferred", label: "Doctors Referred" },
            ],
            points: buildPoints(consultationsByMonth, referralsByMonth),
          },
        },
      });
    }

    // ---------------------------
    // PARTNER DASHBOARD
    // ---------------------------
    if (authRole === "partner") {
      // ✅ find partner by logged-in user_id
      const partner = await db(TABLES.partners).where({ user_id: authUserId }).first();
      if (!partner) {
        return res.status(404).json({ success: false, message: "Partner not found for this user." });
      }

      const partnerId = partner.id;

      const [consultationsRow, doctorReferralsRow] = await Promise.all([
        // 👇 assumes consultations.partner_id exists
        db(TABLES.consultations).where({ partner_id: partnerId }).count({ c: "*" }).first(),

        // 👇 assumes doctor_referrals.partner_id exists
        db(TABLES.doctorReferrals).where({ partner_id: partnerId }).count({ c: "*" }).first(),
      ]);

      const consultationsByMonth = await db(TABLES.consultations)
        .select(db.raw("DATE_FORMAT(created_at, '%Y-%m') as month"))
        .count({ total: "*" })
        .where({ partner_id: partnerId })
        .whereRaw("created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)")
        .groupBy("month");

      const referralsByMonth = await db(TABLES.doctorReferrals)
        .select(db.raw("DATE_FORMAT(created_at, '%Y-%m') as month"))
        .count({ total: "*" })
        .where({ partner_id: partnerId })
        .whereRaw("created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)")
        .groupBy("month");

      return res.json({
        success: true,
        message: "Partner Dashboard summary fetched successfully",
        data: {
          cards: {
            totalConsultations: Number(consultationsRow?.c || 0),
            totalDoctorsReferred: Number(doctorReferralsRow?.c || 0),
          },
          chart: {
            type: "2d_line",
            xAxisKey: "month",
            series: [
              { key: "consultations", label: "Consultations" },
              { key: "doctorsReferred", label: "Doctors Referred" },
            ],
            points: buildPoints(consultationsByMonth, referralsByMonth),
          },
        },
      });
    }

    // If role not supported:
    return res.status(403).json({
      success: false,
      message: `Forbidden. Role "${authRole}" is not supported for dashboard.`,
    });
  } catch (error) {
    console.error("getDashboardSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary",
      error: error.message,
    });
  }
};
