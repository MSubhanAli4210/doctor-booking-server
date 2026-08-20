import { Router } from "express";

import {
  getAdminStats,
  getAdminPatients,
  getAdminAppointments,
  getRecentAppointments,
} from "../controllers/adminController.js";

import { protect, restrictTo } from "../middleware/auth.js";

const router = Router();

router.use(protect);
router.use(restrictTo("admin"));

router.get("/stats", getAdminStats);

router.get("/patients", getAdminPatients);

router.get("/appointments", getAdminAppointments);

router.get("/appointments/recent", getRecentAppointments);

export default router;
