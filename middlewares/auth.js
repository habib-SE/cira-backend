import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt.js";

export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized. Token missing." });
    }

    const token = authHeader.split(" ")[1];

    // ✅ verify
    const payload = jwt.verify(token, JWT_SECRET);

    req.auth = payload; // { id, role, email, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Unauthorized. Invalid or expired token.",
      reason: err.message, // ✅ shows: jwt expired | invalid signature | jwt malformed
    });
  }
};
