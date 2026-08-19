import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary.js';
import User from '../models/User.js';

export const uploadProfilePicture = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No image file provided' });
      return;
    }

    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'doctor-booking/profiles' },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(req.file!.buffer);
    });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { profilePicture: uploadResult.secure_url },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      message: 'Profile picture uploaded',
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: (error as Error).message });
  }
};