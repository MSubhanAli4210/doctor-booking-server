import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IReview extends Document {
  patient: Types.ObjectId;      // ref to User
  doctor: Types.ObjectId;       // ref to DoctorProfile
  appointment: Types.ObjectId;  // ref to Appointment (must be completed to review)
  rating: number;               // 1–5
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: true,
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true, // one review per appointment
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

const Review: Model<IReview> = mongoose.model<IReview>('Review', reviewSchema);

export default Review;