import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAvailabilitySlot {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "17:00"
}

export interface IDoctorProfile extends Document {
  user: Types.ObjectId; // ref to User (role: 'doctor')
  specialty: string;
  degree: string;
  experienceYears: number;
  fees: number;
  address: string;
  about?: string;
  availability: IAvailabilitySlot[];
  isActive: boolean; // admin can deactivate without deleting
  createdAt: Date;
  updatedAt: Date;
}

const availabilitySlotSchema = new Schema<IAvailabilitySlot>(
  {
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false }
);

const doctorProfileSchema = new Schema<IDoctorProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one profile per doctor user
    },
    specialty: {
      type: String,
      required: [true, 'Specialty is required'],
      trim: true,
    },
    degree: {
      type: String,
      required: [true, 'Degree is required'],
      trim: true,
    },
    experienceYears: {
      type: Number,
      required: true,
      min: 0,
    },
    fees: {
      type: Number,
      required: true,
      min: 0,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    about: {
      type: String,
      trim: true,
    },
    availability: {
      type: [availabilitySlotSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const DoctorProfile: Model<IDoctorProfile> = mongoose.model<IDoctorProfile>(
  'DoctorProfile',
  doctorProfileSchema
);

export default DoctorProfile;