import type { Request, Response } from "express";

import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Appointment from "../models/Appointment.js";

export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const [
      totalPatients,
      totalDoctors,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
    ] = await Promise.all([
      User.countDocuments({
        role: "patient",
      }),

      DoctorProfile.countDocuments({
        isActive: true,
      }),

      Appointment.countDocuments(),

      Appointment.countDocuments({
        status: "pending",
      }),

      Appointment.countDocuments({
        status: "confirmed",
      }),

      Appointment.countDocuments({
        status: "completed",
      }),

      Appointment.countDocuments({
        status: "cancelled",
      }),
    ]);

    return res.status(200).json({
      stats: {
        totalPatients,
        totalDoctors,
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        completedAppointments,
        cancelledAppointments,
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);

    return res.status(500).json({
      message: "Failed to load admin statistics",
    });
  }
};

export const getAdminPatients = async (req: Request, res: Response) => {
  try {
    const patients = await User.find({
      role: "patient",
    })
      .select(
        "name email phone address gender dateOfBirth profilePicture createdAt",
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      patients,
    });
  } catch (error) {
    console.error("Get patients error:", error);

    return res.status(500).json({
      message: "Failed to load patients",
    });
  }
};

export const getAdminAppointments = async (req: Request, res: Response) => {
  try {
    const appointments = await Appointment.find()
      .populate("patient", "name email profilePicture")
      .populate({
        path: "doctor",
        populate: {
          path: "user",
          select: "name email profilePicture",
        },
      })
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      appointments,
    });
  } catch (error) {
    console.error("Get admin appointments error:", error);

    return res.status(500).json({
      message: "Failed to load appointments",
    });
  }
};

export const getRecentAppointments = async (req: Request, res: Response) => {
  try {
    const appointments = await Appointment.find()
      .populate("patient", "name email profilePicture")
      .populate({
        path: "doctor",
        populate: {
          path: "user",
          select: "name email profilePicture",
        },
      })
      .sort({
        createdAt: -1,
      })
      .limit(5);

    return res.status(200).json({
      appointments,
    });
  } catch (error) {
    console.error("Recent appointments error:", error);

    return res.status(500).json({
      message: "Failed to load recent appointments",
    });
  }
};
