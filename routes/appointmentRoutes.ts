import { Router } from "express";

import {
  bookAppointment,
  processPayment,
  getMyAppointments,
  getDoctorAppointments,
  updateAppointmentStatus,
  cancelAppointment,
  getAllAppointments,
} from "../controllers/appointmentController.js";

import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/", protect, bookAppointment);
router.get("/my", protect, getMyAppointments);
router.get("/doctor", protect, getDoctorAppointments);
router.post("/:id/payment", protect, processPayment);
router.patch("/:id/status", protect, updateAppointmentStatus);
router.patch("/:id/cancel", protect, cancelAppointment);
router.get("/", protect, getAllAppointments);

export default router;
