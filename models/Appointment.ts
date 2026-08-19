import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed';
export type PaymentFailureReason =
  | 'invalid_card'
  | 'declined'
  | 'expired_card'
  | 'insufficient_funds'
  | null;

export interface IPayment {
  status: PaymentStatus;
  cardLast4?: string;
  paidAt?: Date;
  failureReason?: PaymentFailureReason;
}

export interface IAppointment extends Document {
  patient: Types.ObjectId; // ref to User
  doctor: Types.ObjectId;  // ref to DoctorProfile
  date: string;   // e.g. "2026-08-20"
  time: string;   // e.g. "10:30"
  status: AppointmentStatus;
  fees: number;   // snapshot of doctor's fee at booking time
  payment: IPayment;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    status: {
      type: String,
      enum: ['unpaid', 'paid', 'failed'],
      default: 'unpaid',
    },
    cardLast4: {
      type: String,
      trim: true,
    },
    paidAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      enum: ['invalid_card', 'declined', 'expired_card', 'insufficient_funds', null],
      default: null,
    },
  },
  { _id: false }
);

const appointmentSchema = new Schema<IAppointment>(
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
    date: {
      type: String,
      required: [true, 'Appointment date is required'],
    },
    time: {
      type: String,
      required: [true, 'Appointment time is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    fees: {
      type: Number,
      required: true,
      min: 0,
    },
    payment: {
      type: paymentSchema,
      default: () => ({ status: 'unpaid' }),
    },
  },
  { timestamps: true }
);

// Prevent double-booking: same doctor, same date, same time slot can't have two active appointments
appointmentSchema.index(
  { doctor: 1, date: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } },
  }
);

const Appointment: Model<IAppointment> = mongoose.model<IAppointment>(
  'Appointment',
  appointmentSchema
);

export default Appointment;