import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";
import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import { cleanDoctorName } from "../utils/doctorName.js";

export const createDoctor = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      name,
      email,
      password,
      specialty,
      degree,
      fees,
      address,
      about,
      availability,
    } = req.body;

    const experienceYears = Number(
      req.body.experienceYears ??
        req.body.experience ??
        0,
    );

    if (
      !name ||
      !email ||
      !password ||
      !specialty ||
      !degree ||
      fees === undefined
    ) {
      res.status(400).json({
        message:
          "Name, email, password, specialty, degree, and fees are required",
      });

      return;
    }

    const cleanedName =
      cleanDoctorName(name);

    if (!cleanedName) {
      res.status(400).json({
        message:
          "Doctor name is required",
      });

      return;
    }

    const existingUser =
      await User.findOne({
        email,
      });

    if (existingUser) {
      res.status(409).json({
        message:
          "An account with this email already exists",
      });

      return;
    }

    const user = await User.create({
      name: cleanedName,
      email,
      password,
      role: "doctor",
      address,
    });

    try {
      const doctorProfile =
        await DoctorProfile.create({
          user: user._id,
          specialty,
          degree,
          experienceYears,
          fees,
          address,
          about,
          availability:
            availability || [],
        });

      res.status(201).json({
        message:
          "Doctor created successfully",

        doctor: {
          id: user._id,
          name: user.name,
          email: user.email,
          profile: doctorProfile,
        },
      });
    } catch (profileError) {
      await User.findByIdAndDelete(
        user._id,
      );

      throw profileError;
    }
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to create doctor",

      error:
        (error as Error).message,
    });
  }
};

export const getAllDoctors = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { specialty } =
      req.query;

    const filter: Record<
      string,
      unknown
    > = {
      isActive: true,
    };

    if (specialty) {
      filter.specialty = {
        $regex: specialty as string,
        $options: "i",
      };
    }

    const doctors =
      await DoctorProfile.find(
        filter,
      ).populate(
        "user",
        "name email profilePicture",
      );

    res.status(200).json({
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to fetch doctors",

      error:
        (error as Error).message,
    });
  }
};

export const getDoctorById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id =
      req.params.id as string;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      res.status(400).json({
        message:
          "Invalid doctor ID",
      });

      return;
    }

    const doctor =
      await DoctorProfile.findById(
        id,
      ).populate(
        "user",
        "name email profilePicture",
      );

    if (!doctor) {
      res.status(404).json({
        message:
          "Doctor not found",
      });

      return;
    }

    res.status(200).json({
      doctor,
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to fetch doctor",

      error:
        (error as Error).message,
    });
  }
};

export const updateDoctor = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id =
      req.params.id as string;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      res.status(400).json({
        message:
          "Invalid doctor ID",
      });

      return;
    }

    const doctor =
      await DoctorProfile.findById(
        id,
      );

    if (!doctor) {
      res.status(404).json({
        message:
          "Doctor not found",
      });

      return;
    }

    if (
      req.userRole === "doctor" &&
      doctor.user.toString() !==
        req.userId
    ) {
      res.status(403).json({
        message:
          "You can only update your own profile",
      });

      return;
    }

    if (
      req.body.specialty !==
      undefined
    ) {
      doctor.specialty =
        req.body.specialty;
    }

    if (
      req.body.degree !==
      undefined
    ) {
      doctor.degree =
        req.body.degree;
    }

    if (
      req.body.experienceYears !==
        undefined ||
      req.body.experience !==
        undefined
    ) {
      doctor.experienceYears =
        Number(
          req.body.experienceYears ??
            req.body.experience,
        );
    }

    if (
      req.body.fees !== undefined
    ) {
      doctor.fees = Number(
        req.body.fees,
      );
    }

    if (
      req.body.address !==
      undefined
    ) {
      doctor.address =
        req.body.address;
    }

    if (
      req.body.about !== undefined
    ) {
      doctor.about =
        req.body.about;
    }

    if (
      req.body.availability !==
      undefined
    ) {
      doctor.availability =
        req.body.availability;
    }

    await doctor.save();

    const updatedDoctor =
      await DoctorProfile.findById(
        doctor._id,
      ).populate(
        "user",
        "name email profilePicture",
      );

    res.status(200).json({
      message:
        "Doctor profile updated",
      doctor: updatedDoctor,
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to update doctor",

      error:
        (error as Error).message,
    });
  }
};

export const deactivateDoctor =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const id =
        req.params.id as string;

      if (
        !mongoose.Types.ObjectId.isValid(
          id,
        )
      ) {
        res.status(400).json({
          message:
            "Invalid doctor ID",
        });

        return;
      }

      const doctor =
        await DoctorProfile.findByIdAndUpdate(
          id,
          {
            isActive: false,
          },
          {
            new: true,
          },
        );

      if (!doctor) {
        res.status(404).json({
          message:
            "Doctor not found",
        });

        return;
      }

      res.status(200).json({
        message:
          "Doctor deactivated",
        doctor,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to deactivate doctor",

        error:
          (error as Error)
            .message,
      });
    }
  };