// const nodemailer = require('nodemailer');

// const emailSender = async (email, msg, subject = "Insured Nomads Quote Attachement") => {
//     try {
//         let mailTransporter = nodemailer.createTransport({
//             host: "smtp.hostinger.com",
//             port: 465,
//             secure: true, // true for 465, false for other ports
//             auth: {
//                 user: "insurednomads@instlytechnologies.com",
//                 pass: "InsuredNomads@1122"
//             }
//         });
//         let mailDetails = {
//             from: "insurednomads@instlytechnologies.com",
//             to: email,
//             subject: subject,
//             html: msg,
//         }
//         return await mailTransporter.sendMail(mailDetails);
//     } catch (error) {
//         console.log(error);
//         return false;
//     }
// }

// // Export the function
// module.exports = emailSender;

// utils/emailsender.js
import nodemailer from "nodemailer";

const toBool = (v) => String(v).toLowerCase() === "true";

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = toBool(process.env.SMTP_SECURE);

  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP env missing. Please set SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally SMTP_PORT/SMTP_SECURE).");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
}

export async function sendDemoLeadEmail({ email, phone, createdAt, meta = {} }) {
  const transporter = getTransporter();

  const to = process.env.DEMO_LEADS_TO || "jm@asksteller.com";
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  const subject = `New Demo Lead: ${email}`;

  const text =
`A new demo lead was submitted:

Email: ${email}
Phone: ${phone}
Created At: ${createdAt}

Meta:
IP: ${meta.ip || "-"}
User-Agent: ${meta.ua || "-"}
Origin: ${meta.origin || "-"}
`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5">
      <h2 style="margin: 0 0 12px;">New demo lead</h2>
      <table cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
        <tr><td><b>Email</b></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><b>Phone</b></td><td>${escapeHtml(phone)}</td></tr>
        <tr><td><b>Created</b></td><td>${escapeHtml(createdAt)}</td></tr>
      </table>
      <h3 style="margin: 18px 0 8px;">Meta</h3>
      <ul style="margin: 0; padding-left: 18px;">
        <li><b>IP:</b> ${escapeHtml(meta.ip || "-")}</li>
        <li><b>User-Agent:</b> ${escapeHtml(meta.ua || "-")}</li>
        <li><b>Origin:</b> ${escapeHtml(meta.origin || "-")}</li>
      </ul>
    </div>
  `;

  await transporter.sendMail({ from, to, subject, text, html });

  return true;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
