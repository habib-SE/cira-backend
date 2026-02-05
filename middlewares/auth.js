import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt.js";

export const requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    console.log("🔐 AUTH HEADER:", header);

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized. Missing Bearer token." });
    }

    const token = header.slice(7).trim();
    const decoded = jwt.verify(token, JWT_SECRET);

    // ✅ IMPORTANT FIX
    req.auth = {
      ...decoded,
      id: decoded.id ?? decoded.account_id,
    };

    return next();
  } catch (err) {
    console.log("❌ AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Unauthorized." });
  }
};
