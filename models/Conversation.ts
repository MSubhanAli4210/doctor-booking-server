import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IConversation extends Document {
  patient: Types.ObjectId;
  doctor: Types.ObjectId; // ref to DoctorProfile
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
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
    lastMessage: {
      type: String,
    },
    lastMessageAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// One conversation per patient-doctor pair
conversationSchema.index({ patient: 1, doctor: 1 }, { unique: true });

const Conversation: Model<IConversation> = mongoose.model<IConversation>(
  'Conversation',
  conversationSchema
);

export default Conversation;