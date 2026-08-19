import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Appointment from '../models/Appointment.js';
import DoctorProfile from '../models/DoctorProfile.js';
import { emitToUser } from '../socket.js';
import { isUserOnline, getOnlineUserIds } from '../socket.js';

// Get or create a conversation — only allowed if patient & doctor share an appointment
export const startConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { doctorId } = req.body;
    const patientId = req.userId;

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      res.status(400).json({ message: 'Valid doctor ID is required' });
      return;
    }

    const sharedAppointment = await Appointment.findOne({
      patient: patientId,
      doctor: doctorId,
    });

    if (!sharedAppointment) {
      res.status(403).json({ message: 'You can only message doctors you have booked an appointment with' });
      return;
    }

    let conversation = await Conversation.findOne({ patient: patientId, doctor: doctorId });

    if (!conversation) {
      conversation = await Conversation.create({ patient: patientId, doctor: doctorId });
    }

    res.status(200).json({ conversation });
  } catch (error) {
    res.status(500).json({ message: 'Failed to start conversation', error: (error as Error).message });
  }
};

// List all conversations for the logged-in user (patient or doctor)
export const getMyConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    let conversations;

    if (req.userRole === 'doctor') {
      const doctorProfile = await DoctorProfile.findOne({ user: req.userId });
      if (!doctorProfile) {
        res.status(404).json({ message: 'Doctor profile not found' });
        return;
      }
      conversations = await Conversation.find({ doctor: doctorProfile._id })
        .populate('patient', 'name email profilePicture')
        .sort({ lastMessageAt: -1 });
    } else {
      conversations = await Conversation.find({ patient: req.userId })
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name email profilePicture' } })
        .sort({ lastMessageAt: -1 });
    }

    res.status(200).json({ count: conversations.length, conversations });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch conversations', error: (error as Error).message });
  }
};

// Get message history for a conversation
export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.conversationId as string;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }

    // Verify the requester is part of this conversation
    const doctorProfile = await DoctorProfile.findById(conversation.doctor);
    const isParticipant =
      conversation.patient.toString() === req.userId ||
      doctorProfile?.user.toString() === req.userId;

    if (!isParticipant) {
      res.status(403).json({ message: 'You do not have access to this conversation' });
      return;
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'name profilePicture')
      .sort({ createdAt: 1 });

    // Mark messages sent by the other party as read
    await Message.updateMany(
      { conversation: conversationId, sender: { $ne: req.userId }, read: false },
      { read: true }
    );

    res.status(200).json({ count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages', error: (error as Error).message });
  }
};

// Send a message (REST fallback / persistence — also emitted live via socket)
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.conversationId as string;
    const { content } = req.body;
    const senderId = req.userId;

    if (!content || !content.trim()) {
      res.status(400).json({ message: 'Message content is required' });
      return;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }

    const doctorProfile = await DoctorProfile.findById(conversation.doctor);
    const isParticipant =
      conversation.patient.toString() === senderId ||
      doctorProfile?.user.toString() === senderId;

    if (!isParticipant) {
      res.status(403).json({ message: 'You do not have access to this conversation' });
      return;
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      content: content.trim(),
    });

    conversation.lastMessage = content.trim();
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Determine the recipient and notify them live
    const recipientId =
      conversation.patient.toString() === senderId
        ? doctorProfile?.user.toString()
        : conversation.patient.toString();

    if (recipientId) {
      emitToUser(recipientId, 'newMessage', {
        conversationId,
        message,
      });
    }

    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message', error: (error as Error).message });
  }
};

// Returns which of the given userIds are currently online — used to paint initial green dots
export const getOnlineStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const onlineIds = getOnlineUserIds();
    res.status(200).json({ onlineUserIds: onlineIds });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch online status', error: (error as Error).message });
  }
};