
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const updateAdminPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    const admin = await User.findOne({
      email: 'admin@doctorbooking.com',
    }).select('+password');

    if (!admin) {
      console.log('Admin not found');
      process.exitCode = 1;
      return;
    }

    admin.password = 'Admin123';
    await admin.save();

    console.log('Admin password updated successfully');
  } catch (error) {
    console.error('Failed to update admin password:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

updateAdminPassword();
