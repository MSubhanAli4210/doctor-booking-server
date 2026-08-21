import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";

import Appointment from "../models/Appointment.js";
import DoctorProfile from "../models/DoctorProfile.js";
import {
  isValidLuhn,
  isCardExpired,
} from "../utils/luhnCheck.js";
import { emitToUser } from "../socket.js";

const timeToMinutes = (
  value: string,
): number | null => {
  const match = String(value)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(
    match[1],
  );

  const minutes = Number(
    match[2],
  );

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

export const bookAppointment =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        doctorId,
        date,
        time,
      } = req.body;

      const patientId =
        req.userId;

      if (!patientId) {
        res.status(401).json({
          message: "Unauthorized",
        });
        return;
      }

      if (
        !doctorId ||
        !date ||
        !time
      ) {
        res.status(400).json({
          message:
            "Doctor, date, and time are required",
        });
        return;
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          doctorId,
        )
      ) {
        res.status(400).json({
          message:
            "Invalid doctor ID",
        });
        return;
      }

      const requestedDate =
        new Date(
          `${date}T00:00:00`,
        );

      if (
        Number.isNaN(
          requestedDate.getTime(),
        )
      ) {
        res.status(400).json({
          message:
            "Invalid appointment date",
        });
        return;
      }

      const requestedTime =
        String(time).trim();

      const requestedMinutes =
        timeToMinutes(
          requestedTime,
        );

      if (
        requestedMinutes ===
        null
      ) {
        res.status(400).json({
          message:
            "Invalid appointment time",
        });
        return;
      }

      const doctor =
        await DoctorProfile.findById(
          doctorId,
        );

      if (
        !doctor ||
        !doctor.isActive
      ) {
        res.status(404).json({
          message:
            "Doctor not found or not currently accepting appointments",
        });
        return;
      }

      const requestedDay =
        requestedDate
          .toLocaleDateString(
            "en-US",
            {
              weekday: "long",
            },
          )
          .toLowerCase();

      const dayAvailability =
        doctor.availability.filter(
          (slot) =>
            slot.day ===
            requestedDay,
        );

      if (
        dayAvailability.length ===
        0
      ) {
        res.status(400).json({
          message: `Doctor is not available on ${requestedDay}`,
        });
        return;
      }

      const timeIsAvailable =
        dayAvailability.some(
          (slot) => {
            const start =
              timeToMinutes(
                slot.startTime,
              );

            const end =
              timeToMinutes(
                slot.endTime,
              );

            if (
              start === null ||
              end === null
            ) {
              return false;
            }

            return (
              requestedMinutes >=
                start &&
              requestedMinutes <
                end &&
              (requestedMinutes -
                start) %
                30 ===
                0
            );
          },
        );

      if (!timeIsAvailable) {
        res.status(400).json({
          message:
            "Doctor is not available at this time",
        });
        return;
      }

      const conflict =
        await Appointment.findOne(
          {
            doctor: doctorId,
            date,
            time:
              requestedTime,
            status: {
              $in: [
                "pending",
                "confirmed",
              ],
            },
          },
        );

      if (conflict) {
        res.status(409).json({
          message:
            "This time slot is already booked",
        });
        return;
      }

      const appointment =
        await Appointment.create(
          {
            patient:
              patientId,
            doctor:
              doctorId,
            date,
            time:
              requestedTime,
            fees:
              doctor.fees,
            status:
              "pending",
            payment: {
              status:
                "unpaid",
            },
          },
        );

      const populatedAppointment =
        await Appointment.findById(
          appointment._id,
        ).populate(
          "patient",
          "name email profilePicture",
        );

      emitToUser(
        doctor.user.toString(),
        "appointmentBooked",
        {
          appointment:
            populatedAppointment,
        },
      );

      res.status(201).json({
        message:
          "Appointment booked",
        appointment:
          populatedAppointment,
      });
    } catch (error: any) {
      if (
        error?.code === 11000
      ) {
        res.status(409).json({
          message:
            "This time slot is already booked",
        });
        return;
      }

      res.status(500).json({
        message:
          "Failed to book appointment",
        error:
          error?.message ||
          "Unknown error",
      });
    }
  };

export const processPayment =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const appointmentId =
        req.params.id as string;

      const {
        cardNumber,
        expiryMonth,
        expiryYear,
        cvv,
      } = req.body;

      const patientId =
        req.userId;

      if (!patientId) {
        res.status(401).json({
          message: "Unauthorized",
        });
        return;
      }

      if (
        !cardNumber ||
        !expiryMonth ||
        !expiryYear ||
        !cvv
      ) {
        res.status(400).json({
          message:
            "Card number, expiry, and CVV are required",
        });
        return;
      }

      const appointment =
        await Appointment.findById(
          appointmentId,
        );

      if (!appointment) {
        res.status(404).json({
          message:
            "Appointment not found",
        });
        return;
      }

      if (
        appointment.patient.toString() !==
        patientId
      ) {
        res.status(403).json({
          message:
            "You can only pay for your own appointments",
        });
        return;
      }

      if (
        appointment.payment
          .status === "paid"
      ) {
        res.status(400).json({
          message:
            "This appointment has already been paid for",
        });
        return;
      }

      if (
        ![
          "pending",
          "confirmed",
        ].includes(
          appointment.status,
        )
      ) {
        res.status(400).json({
          message:
            "This appointment cannot be paid",
        });
        return;
      }

      const cleanCardNumber =
        String(
          cardNumber,
        ).replace(/\D/g, "");

      const cardLast4 =
        cleanCardNumber.slice(
          -4,
        );

      if (
        !isValidLuhn(
          cardNumber,
        )
      ) {
        appointment.payment = {
          status: "failed",
          cardLast4,
          failureReason:
            "invalid_card",
        };

        await appointment.save();

        res.status(400).json({
          message:
            "Invalid card number",
          failureReason:
            "invalid_card",
        });
        return;
      }

      if (
        isCardExpired(
          Number(
            expiryMonth,
          ),
          Number(
            expiryYear,
          ),
        )
      ) {
        appointment.payment = {
          status: "failed",
          cardLast4,
          failureReason:
            "expired_card",
        };

        await appointment.save();

        res.status(400).json({
          message:
            "Card has expired",
          failureReason:
            "expired_card",
        });
        return;
      }

      if (
        cleanCardNumber.endsWith(
          "0002",
        )
      ) {
        appointment.payment = {
          status: "failed",
          cardLast4,
          failureReason:
            "declined",
        };

        await appointment.save();

        res.status(402).json({
          message:
            "Card was declined",
          failureReason:
            "declined",
        });
        return;
      }

      if (
        cleanCardNumber.endsWith(
          "0003",
        )
      ) {
        appointment.payment = {
          status: "failed",
          cardLast4,
          failureReason:
            "insufficient_funds",
        };

        await appointment.save();

        res.status(402).json({
          message:
            "Insufficient funds",
          failureReason:
            "insufficient_funds",
        });
        return;
      }

      if (
        Math.random() < 0.2
      ) {
        appointment.payment = {
          status: "failed",
          cardLast4,
          failureReason:
            "declined",
        };

        await appointment.save();

        res.status(402).json({
          message:
            "Card was declined",
          failureReason:
            "declined",
        });
        return;
      }

      appointment.payment = {
        status: "paid",
        cardLast4,
        paidAt: new Date(),
        failureReason: null,
      };

      appointment.status =
        "confirmed";

      await appointment.save();

      const doctor =
        await DoctorProfile.findById(
          appointment.doctor,
        );

      if (doctor) {
        emitToUser(
          doctor.user.toString(),
          "appointmentStatusUpdated",
          {
            appointmentId:
              appointment._id,
            status:
              appointment.status,
          },
        );
      }

      res.status(200).json({
        message:
          "Payment successful",
        appointment,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Payment processing failed",
        error: (
          error as Error
        ).message,
      });
    }
  };

export const getMyAppointments =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          message: "Unauthorized",
        });
        return;
      }

      const appointments =
        await Appointment.find({
          patient:
            req.userId,
        })
          .populate({
            path: "doctor",
            populate: {
              path: "user",
              select:
                "name email profilePicture",
            },
          })
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        count:
          appointments.length,
        appointments,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to fetch appointments",
        error: (
          error as Error
        ).message,
      });
    }
  };

export const getDoctorAppointments =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          message: "Unauthorized",
        });
        return;
      }

      const doctorProfile =
        await DoctorProfile.findOne(
          {
            user: req.userId,
          },
        );

      if (!doctorProfile) {
        res.status(404).json({
          message:
            "Doctor profile not found",
        });
        return;
      }

      const appointments =
        await Appointment.find({
          doctor:
            doctorProfile._id,
        })
          .populate(
            "patient",
            "name email profilePicture",
          )
          .sort({
            date: 1,
            time: 1,
          });

      res.status(200).json({
        count:
          appointments.length,
        appointments,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to fetch appointments",
        error: (
          error as Error
        ).message,
      });
    }
  };

export const updateAppointmentStatus =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const appointmentId =
        req.params.id as string;

      const { status } =
        req.body;

      if (!req.userId) {
        res.status(401).json({
          message: "Unauthorized",
        });
        return;
      }

      if (
        ![
          "completed",
          "cancelled",
        ].includes(status)
      ) {
        res.status(400).json({
          message:
            'Status must be "completed" or "cancelled"',
        });
        return;
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          appointmentId,
        )
      ) {
        res.status(400).json({
          message:
            "Invalid appointment ID",
        });
        return;
      }

      const appointment =
        await Appointment.findById(
          appointmentId,
        );

      if (!appointment) {
        res.status(404).json({
          message:
            "Appointment not found",
        });
        return;
      }

      const doctorProfile =
        await DoctorProfile.findOne(
          {
            user: req.userId,
          },
        );

      if (
        !doctorProfile ||
        appointment.doctor.toString() !==
          doctorProfile._id.toString()
      ) {
        res.status(403).json({
          message:
            "You can only update your own appointments",
        });
        return;
      }

      if (
        appointment.status ===
        "cancelled"
      ) {
        res.status(400).json({
          message:
            "Appointment is already cancelled",
        });
        return;
      }

      if (
        appointment.status ===
        "completed"
      ) {
        res.status(400).json({
          message:
            "Completed appointments cannot be changed",
        });
        return;
      }

      let refunded = false;

      if (
        status === "cancelled" &&
        appointment.payment?.status ===
          "paid"
      ) {
        appointment.payment.status =
          "refunded";

        appointment.payment.refundedAt =
          new Date();

        refunded = true;
      }

      appointment.status =
        status;

      await appointment.save();

      emitToUser(
        appointment.patient.toString(),
        "appointmentStatusUpdated",
        {
          appointmentId:
            appointment._id,
          status:
            appointment.status,
          paymentStatus:
            appointment.payment?.status,
          refunded,
        },
      );

      res.status(200).json({
        message: refunded
          ? "Appointment cancelled and payment refunded"
          : `Appointment marked as ${status}`,
        appointment,
        refunded,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to update appointment",
        error: (
          error as Error
        ).message,
      });
    }
  };

export const cancelAppointment =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const appointmentId =
        req.params.id as string;

      if (!req.userId) {
        res.status(401).json({
          message: "Unauthorized",
        });
        return;
      }

      const appointment =
        await Appointment.findById(
          appointmentId,
        );

      if (!appointment) {
        res.status(404).json({
          message:
            "Appointment not found",
        });
        return;
      }

      if (
        appointment.patient.toString() !==
        req.userId
      ) {
        res.status(403).json({
          message:
            "You can only cancel your own appointments",
        });
        return;
      }

      if (
        ![
          "pending",
          "confirmed",
        ].includes(
          appointment.status,
        )
      ) {
        res.status(400).json({
          message: `Cannot cancel an appointment that is already ${appointment.status}`,
        });
        return;
      }

      appointment.status =
        "cancelled";

      await appointment.save();

      const doctorProfile =
        await DoctorProfile.findById(
          appointment.doctor,
        );

      if (doctorProfile) {
        emitToUser(
          doctorProfile.user.toString(),
          "appointmentCancelled",
          {
            appointmentId:
              appointment._id,
          },
        );
      }

      res.status(200).json({
        message:
          "Appointment cancelled",
        appointment,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to cancel appointment",
        error: (
          error as Error
        ).message,
      });
    }
  };

export const getAllAppointments =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const appointments =
        await Appointment.find()
          .populate(
            "patient",
            "name email profilePicture",
          )
          .populate({
            path: "doctor",
            populate: {
              path: "user",
              select:
                "name email profilePicture",
            },
          })
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        count:
          appointments.length,
        appointments,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to fetch appointments",
        error: (
          error as Error
        ).message,
      });
    }
  };