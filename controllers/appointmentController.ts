import { Request, Response } from "express";
import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import DoctorProfile from "../models/DoctorProfile.js";
import { isValidLuhn, isCardExpired } from "../utils/luhnCheck.js";
import { emitToUser } from "../socket.js";

// Patient — book a new appointment (pending, unpaid)
export const bookAppointment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { doctorId, date, time } = req.body;
    const patientId = req.userId;

    if (!doctorId || !date || !time) {
      res.status(400).json({ message: "Doctor, date, and time are required" });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      res.status(400).json({ message: "Invalid doctor ID" });
      return;
    }

    const doctor = await DoctorProfile.findById(doctorId);
    if (!doctor || !doctor.isActive) {
      res.status(404).json({
        message: "Doctor not found or not currently accepting appointments",
      });
      return;
    }

    // Check the requested day falls within the doctor's declared availability
    const requestedDay = new Date(date)
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase();

    const dayIsAvailable = doctor.availability.some(
      (slot) => slot.day === requestedDay,
    );
    if (doctor.availability.length > 0 && !dayIsAvailable) {
      res
        .status(400)
        .json({ message: `Doctor is not available on ${requestedDay}` });
      return;
    }

    // Application-level double-booking check (clean 409, before hitting the DB unique index)
    const conflict = await Appointment.findOne({
      doctor: doctorId,
      date,
      time,
      status: { $in: ["pending", "confirmed"] },
    });

    if (conflict) {
      res.status(409).json({ message: "This time slot is already booked" });
      return;
    }

    const appointment = await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      date,
      time,
      fees: doctor.fees, // snapshot fee at booking time
      status: "pending",
      payment: { status: "unpaid" },
    });

    res.status(201).json({ message: "Appointment booked", appointment });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: "This time slot is already booked" });
      return;
    }
    res
      .status(500)
      .json({ message: "Failed to book appointment", error: error.message });
  }
};

// Patient — pay for a pending appointment (simulated card processing)
export const processPayment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const appointmentId = req.params.id as string;
    const { cardNumber, expiryMonth, expiryYear, cvv } = req.body;
    const patientId = req.userId;

    if (!cardNumber || !expiryMonth || !expiryYear || !cvv) {
      res
        .status(400)
        .json({ message: "Card number, expiry, and CVV are required" });
      return;
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ message: "Appointment not found" });
      return;
    }

    if (appointment.patient.toString() !== patientId) {
      res
        .status(403)
        .json({ message: "You can only pay for your own appointments" });
      return;
    }

    if (appointment.payment.status === "paid") {
      res
        .status(400)
        .json({ message: "This appointment has already been paid for" });
      return;
    }

    const cardLast4 = cardNumber.replace(/\D/g, "").slice(-4);

    // 1. Format check — Luhn algorithm
    if (!isValidLuhn(cardNumber)) {
      appointment.payment = {
        status: "failed",
        cardLast4,
        failureReason: "invalid_card",
      };
      await appointment.save();
      res.status(400).json({
        message: "Invalid card number",
        failureReason: "invalid_card",
      });
      return;
    }

    // 2. Expired card check
    if (isCardExpired(Number(expiryMonth), Number(expiryYear))) {
      appointment.payment = {
        status: "failed",
        cardLast4,
        failureReason: "expired_card",
      };
      await appointment.save();
      res
        .status(400)
        .json({ message: "Card has expired", failureReason: "expired_card" });
      return;
    }

    // 3. Simulated decline — test card pattern (Stripe-style: ends in 0002 always declines)
    if (cardNumber.replace(/\D/g, "").endsWith("0002")) {
      appointment.payment = {
        status: "failed",
        cardLast4,
        failureReason: "declined",
      };
      await appointment.save();
      res
        .status(402)
        .json({ message: "Card was declined", failureReason: "declined" });
      return;
    }

    // 4. Simulated insufficient funds — test card pattern (ends in 0003)
    if (cardNumber.replace(/\D/g, "").endsWith("0003")) {
      appointment.payment = {
        status: "failed",
        cardLast4,
        failureReason: "insufficient_funds",
      };
      await appointment.save();
      res.status(402).json({
        message: "Insufficient funds",
        failureReason: "insufficient_funds",
      });
      return;
    }

    // 5. Random decline — roughly 1-in-5 chance, simulates real-world gateway variability
    if (Math.random() < 0.2) {
      appointment.payment = {
        status: "failed",
        cardLast4,
        failureReason: "declined",
      };
      await appointment.save();
      res
        .status(402)
        .json({ message: "Card was declined", failureReason: "declined" });
      return;
    }

    // Success
    appointment.payment = {
      status: "paid",
      cardLast4,
      paidAt: new Date(),
      failureReason: null,
    };
    appointment.status = "confirmed";
    await appointment.save();

    res.status(200).json({ message: "Payment successful", appointment });
  } catch (error) {
    res.status(500).json({
      message: "Payment processing failed",
      error: (error as Error).message,
    });
  }
};

// Patient — their own appointments
export const getMyAppointments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const appointments = await Appointment.find({ patient: req.userId })
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ count: appointments.length, appointments });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch appointments",
      error: (error as Error).message,
    });
  }
};

// Doctor — appointments booked with them
export const getDoctorAppointments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ user: req.userId });
    if (!doctorProfile) {
      res.status(404).json({ message: "Doctor profile not found" });
      return;
    }

    const appointments = await Appointment.find({ doctor: doctorProfile._id })
      .populate("patient", "name email")
      .sort({ date: 1, time: 1 });

    res.status(200).json({ count: appointments.length, appointments });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch appointments",
      error: (error as Error).message,
    });
  }
};

// Doctor — mark completed or cancelled
export const updateAppointmentStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const appointmentId = req.params.id as string;
    const { status } = req.body;

    if (!["completed", "cancelled"].includes(status)) {
      res
        .status(400)
        .json({ message: 'Status must be "completed" or "cancelled"' });
      return;
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ message: "Appointment not found" });
      return;
    }

    const doctorProfile = await DoctorProfile.findOne({ user: req.userId });
    if (
      !doctorProfile ||
      appointment.doctor.toString() !== doctorProfile._id.toString()
    ) {
      res
        .status(403)
        .json({ message: "You can only update your own appointments" });
      return;
    }

    appointment.status = status;

    await appointment.save();
    emitToUser(appointment.patient.toString(), "appointmentStatusUpdated", {
      appointmentId: appointment._id,
      status: appointment.status,
    });

    res
      .status(200)
      .json({ message: `Appointment marked as ${status}`, appointment });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update appointment",
      error: (error as Error).message,
    });
  }
};

// Patient — cancel their own pending/confirmed appointment
export const cancelAppointment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const appointmentId = req.params.id as string;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ message: "Appointment not found" });
      return;
    }

    if (appointment.patient.toString() !== req.userId) {
      res
        .status(403)
        .json({ message: "You can only cancel your own appointments" });
      return;
    }

    if (!["pending", "confirmed"].includes(appointment.status)) {
      res.status(400).json({
        message: `Cannot cancel an appointment that is already ${appointment.status}`,
      });
      return;
    }

    appointment.status = "cancelled";
    await appointment.save();

    // Notify the doctor that a patient cancelled
    const doctorProfile = await DoctorProfile.findById(appointment.doctor);
    if (doctorProfile) {
      emitToUser(doctorProfile.user.toString(), "appointmentCancelled", {
        appointmentId: appointment._id,
      });
    }

    res.status(200).json({ message: "Appointment cancelled", appointment });
  } catch (error) {
    res.status(500).json({
      message: "Failed to cancel appointment",
      error: (error as Error).message,
    });
  }
};

// Admin — full list, for dashboard
export const getAllAppointments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const appointments = await Appointment.find()
      .populate("patient", "name email")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ count: appointments.length, appointments });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch appointments",
      error: (error as Error).message,
    });
  }
};
