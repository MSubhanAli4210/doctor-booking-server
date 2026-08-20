import type {
  Request,
  Response,
} from "express";

import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

export const register = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      gender,
      dateOfBirth,
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      res.status(400).json({
        message:
          "Name, email, and password are required",
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
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone,
      address,
      gender,
      dateOfBirth,
      role: "patient",
    });

    const token =
      generateToken({
        userId:
          user._id.toString(),
        role: user.role,
      });

    res.status(201).json({
      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        gender: user.gender,
        dateOfBirth:
          user.dateOfBirth,
        profilePicture:
          user.profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Registration failed",

      error:
        (error as Error).message,
    });
  }
};

export const login = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (
      !email ||
      !password
    ) {
      res.status(400).json({
        message:
          "Email and password are required",
      });

      return;
    }

    const user =
      await User.findOne({
        email:
          email.trim().toLowerCase(),
      }).select("+password");

    if (!user) {
      res.status(401).json({
        message:
          "Invalid email or password",
      });

      return;
    }

    const isMatch =
      await user.comparePassword(
        password,
      );

    if (!isMatch) {
      res.status(401).json({
        message:
          "Invalid email or password",
      });

      return;
    }

    const token =
      generateToken({
        userId:
          user._id.toString(),
        role: user.role,
      });

    res.status(200).json({
      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        gender: user.gender,
        dateOfBirth:
          user.dateOfBirth,
        profilePicture:
          user.profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Login failed",

      error:
        (error as Error).message,
    });
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        message:
          "Unauthorized",
      });

      return;
    }

    const user =
      await User.findById(
        req.userId,
      );

    if (!user) {
      res.status(404).json({
        message:
          "User not found",
      });

      return;
    }

    if (
      user.role !== "patient"
    ) {
      res.status(403).json({
        message:
          "Only patients can update their profile here",
      });

      return;
    }

    const {
      name,
      phone,
      address,
      gender,
      dateOfBirth,
    } = req.body;

    if (
      name !== undefined
    ) {
      const cleanedName =
        String(name).trim();

      if (!cleanedName) {
        res.status(400).json({
          message:
            "Name cannot be empty",
        });

        return;
      }

      user.name =
        cleanedName;
    }

    if (
      phone !== undefined
    ) {
      user.phone =
        String(phone).trim();
    }

    if (
      address !== undefined
    ) {
      user.address =
        String(address).trim();
    }

    if (
      gender !== undefined
    ) {
      if (
        gender &&
        ![
          "male",
          "female",
          "other",
        ].includes(gender)
      ) {
        res.status(400).json({
          message:
            "Invalid gender",
        });

        return;
      }

      user.gender =
        gender || undefined;
    }

    if (
      dateOfBirth !== undefined
    ) {
      if (!dateOfBirth) {
        user.dateOfBirth =
          undefined;
      } else {
        const parsedDate =
          new Date(
            dateOfBirth,
          );

        if (
          Number.isNaN(
            parsedDate.getTime(),
          )
        ) {
          res.status(400).json({
            message:
              "Invalid date of birth",
          });

          return;
        }

        user.dateOfBirth =
          parsedDate;
      }
    }

    await user.save();

    res.status(200).json({
      message:
        "Profile updated successfully",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        gender: user.gender,
        dateOfBirth:
          user.dateOfBirth,
        profilePicture:
          user.profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to update profile",

      error:
        (error as Error).message,
    });
  }
};