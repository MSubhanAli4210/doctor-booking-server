import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';

// Admin only — creates both the User (role: doctor) and DoctorProfile in one step
export const createDoctor = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      password,
      specialty,
      degree,
      experienceYears,
      fees,
      address,
      about,
      availability,
    } = req.body;

    if (!name || !email || !password || !specialty || !degree || fees === undefined) {
      res.status(400).json({
        message: 'Name, email, password, specialty, degree, and fees are required',
      });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: 'An account with this email already exists' });
      return;
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'doctor',
      address,
    });

    try {
      const doctorProfile = await DoctorProfile.create({
        user: user._id,
        specialty,
        degree,
        experienceYears: experienceYears || 0,
        fees,
        address,
        about,
        availability: availability || [],
      });

      res.status(201).json({
        message: 'Doctor created successfully',
        doctor: {
          id: user._id,
          name: user.name,
          email: user.email,
          profile: doctorProfile,
        },
      });
    } catch (profileError) {
      // Roll back the user if profile creation fails, so we don't get an orphaned doctor account
      await User.findByIdAndDelete(user._id);
      throw profileError;
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to create doctor', error: (error as Error).message });
  }
};

// Public — list doctors, optional specialty filter/search
export const getAllDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { specialty } = req.query;

    const filter: Record<string, unknown> = { isActive: true };
    if (specialty) {
      filter.specialty = { $regex: specialty as string, $options: 'i' };
    }

    const doctors = await DoctorProfile.find(filter).populate('user', 'name email');

    res.status(200).json({ count: doctors.length, doctors });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch doctors', error: (error as Error).message });
  }
};

// Public — single doctor profile
export const getDoctorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid doctor ID' });
      return;
    }

    const doctor = await DoctorProfile.findById(id).populate('user', 'name email');

    if (!doctor) {
      res.status(404).json({ message: 'Doctor not found' });
      return;
    }

    res.status(200).json({ doctor });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch doctor', error: (error as Error).message });
  }
};

// Admin, or the doctor themself — update profile fields
export const updateDoctor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid doctor ID' });
      return;
    }

    const doctor = await DoctorProfile.findById(id);
    if (!doctor) {
      res.status(404).json({ message: 'Doctor not found' });
      return;
    }

    // If the requester is a doctor (not admin), make sure they're only editing their own profile
    if (req.userRole === 'doctor' && doctor.user.toString() !== req.userId) {
      res.status(403).json({ message: 'You can only update your own profile' });
      return;
    }

    const allowedUpdates = [
      'specialty',
      'degree',
      'experienceYears',
      'fees',
      'address',
      'about',
      'availability',
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        (doctor as any)[field] = req.body[field];
      }
    });

    await doctor.save();

    res.status(200).json({ message: 'Doctor profile updated', doctor });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update doctor', error: (error as Error).message });
  }
};

// Admin only — deactivate rather than hard delete, to preserve appointment/review history
export const deactivateDoctor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string ;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid doctor ID' });
      return;
    }

    const doctor = await DoctorProfile.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!doctor) {
      res.status(404).json({ message: 'Doctor not found' });
      return;
    }

    res.status(200).json({ message: 'Doctor deactivated', doctor });
  } catch (error) {
    res.status(500).json({ message: 'Failed to deactivate doctor', error: (error as Error).message });
  }
};