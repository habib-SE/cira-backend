import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { getDashboardSummary } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/dashboard", requireAuth, getDashboardSummary);

export default router;
