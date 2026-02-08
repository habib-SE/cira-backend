import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { getDashboardSummary } from "../controllers/dashboardController.js";

const router = express.Router();

// GET /api/dashboard
router.get("/", requireAuth, getDashboardSummary);

export default router;
