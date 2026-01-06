// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { sendDemoLeadEmail } from "./utils/emailsender.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: ["http://localhost:5174", "https://askainurse.com"],
  credentials: true,
}));


app.use(express.json({ limit: "50kb" }));

// basic anti-spam rate limit for this endpoint
const demoLeadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // per IP
  standardHeaders: true,
  legacyHeaders: false,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_RE = /^[+]?[\d\s().-]{7,20}$/;

app.post("/api/demo-access", demoLeadLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const createdAt = String(req.body?.createdAt || new Date().toISOString());

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, message: "Invalid email" });
    }
    if (!phone || !PHONE_RE.test(phone)) {
      return res.status(400).json({ ok: false, message: "Invalid phone" });
    }

    const meta = {
      ip: req.headers["x-forwarded-for"]?.toString()?.split(",")[0]?.trim() || req.socket.remoteAddress,
      ua: req.headers["user-agent"],
      origin: req.headers["origin"],
    };

    await sendDemoLeadEmail({ email, phone, createdAt, meta });

    return res.json({ ok: true, message: "Lead sent" });
  } catch (err) {
    console.error("[/api/demo-access] error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
