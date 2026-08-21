import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Appointment from "../models/Appointment.js";
import DoctorProfile from "../models/DoctorProfile.js";

import {
  emitToUser,
  getOnlineUserIds,
} from "../socket.js";

export const startConversation =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const patientId =
        req.userId;

      const {
        doctorId,
      } = req.body;

      if (!patientId) {
        res.status(401).json({
          message: "Unauthorized",
        });

        return;
      }

      if (
        !doctorId ||
        !mongoose.Types.ObjectId.isValid(
          doctorId,
        )
      ) {
        res.status(400).json({
          message:
            "Valid doctor ID is required",
        });

        return;
      }

      const doctorProfile =
        await DoctorProfile.findById(
          doctorId,
        );

      if (!doctorProfile) {
        res.status(404).json({
          message:
            "Doctor profile not found",
        });

        return;
      }

      const sharedAppointment =
        await Appointment.findOne({
          patient:
            patientId,

          doctor:
            doctorProfile._id,
        });

      if (!sharedAppointment) {
        res.status(403).json({
          message:
            "You can only message doctors you have booked an appointment with",
        });

        return;
      }

      let conversation =
        await Conversation.findOne({
          patient:
            patientId,

          doctor:
            doctorProfile._id,
        });

      if (!conversation) {
        conversation =
          await Conversation.create({
            patient:
              patientId,

            doctor:
              doctorProfile._id,
          });
      }

      const populatedConversation =
        await Conversation.findById(
          conversation._id,
        )
          .populate(
            "patient",
            "name email profilePicture",
          )
          .populate({
            path: "doctor",
            populate: {
              path: "user",
              select:
                "name email profilePicture",
            },
          });

      res.status(200).json({
        conversation:
          populatedConversation,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to start conversation",

        error:
          (error as Error).message,
      });
    }
  };

export const getMyConversations =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          message: "Unauthorized",
        });

        return;
      }

      let conversations;

      if (
        req.userRole ===
        "doctor"
      ) {
        const doctorProfile =
          await DoctorProfile.findOne({
            user:
              req.userId,
          });

        if (!doctorProfile) {
          res.status(404).json({
            message:
              "Doctor profile not found",
          });

          return;
        }

        conversations =
          await Conversation.find({
            doctor:
              doctorProfile._id,
          })
            .populate(
              "patient",
              "name email profilePicture",
            )
            .populate({
              path: "doctor",
              populate: {
                path: "user",
                select:
                  "name email profilePicture",
              },
            })
            .sort({
              lastMessageAt: -1,
              updatedAt: -1,
            });
      } else {
        conversations =
          await Conversation.find({
            patient:
              req.userId,
          })
            .populate(
              "patient",
              "name email profilePicture",
            )
            .populate({
              path: "doctor",
              populate: {
                path: "user",
                select:
                  "name email profilePicture",
              },
            })
            .sort({
              lastMessageAt: -1,
              updatedAt: -1,
            });
      }

      const conversationIds =
        conversations.map(
          (conversation) =>
            conversation._id,
        );

      const unreadCounts =
        await Message.aggregate([
          {
            $match: {
              conversation: {
                $in:
                  conversationIds,
              },

              sender: {
                $ne:
                  new mongoose.Types.ObjectId(
                    req.userId,
                  ),
              },

              read: false,
            },
          },

          {
            $group: {
              _id:
                "$conversation",

              count: {
                $sum: 1,
              },
            },
          },
        ]);

      const unreadMap =
        new Map<
          string,
          number
        >();

      unreadCounts.forEach(
        (item) => {
          unreadMap.set(
            item._id.toString(),
            item.count,
          );
        },
      );

      const result =
        conversations.map(
          (conversation) => ({
            ...conversation.toObject(),

            unreadCount:
              unreadMap.get(
                conversation._id.toString(),
              ) || 0,
          }),
        );

      res.status(200).json({
        count:
          result.length,

        conversations:
          result,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to fetch conversations",

        error:
          (error as Error).message,
      });
    }
  };

export const getMessages =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          message: "Unauthorized",
        });

        return;
      }

      const conversationId =
        req.params
          .conversationId as string;

      if (
        !mongoose.Types.ObjectId.isValid(
          conversationId,
        )
      ) {
        res.status(400).json({
          message:
            "Invalid conversation ID",
        });

        return;
      }

      const conversation =
        await Conversation.findById(
          conversationId,
        );

      if (!conversation) {
        res.status(404).json({
          message:
            "Conversation not found",
        });

        return;
      }

      const doctorProfile =
        await DoctorProfile.findById(
          conversation.doctor,
        );

      if (!doctorProfile) {
        res.status(404).json({
          message:
            "Doctor profile not found",
        });

        return;
      }

      const isParticipant =
        conversation.patient.toString() ===
          req.userId ||
        doctorProfile.user.toString() ===
          req.userId;

      if (!isParticipant) {
        res.status(403).json({
          message:
            "You do not have access to this conversation",
        });

        return;
      }

      await Message.updateMany(
        {
          conversation:
            conversationId,

          sender: {
            $ne:
              req.userId,
          },

          read:
            false,
        },
        {
          $set: {
            read:
              true,
          },
        },
      );

      const messages =
        await Message.find({
          conversation:
            conversationId,
        })
          .populate(
            "sender",
            "name email profilePicture",
          )
          .sort({
            createdAt: 1,
          });

      res.status(200).json({
        count:
          messages.length,

        messages,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to fetch messages",

        error:
          (error as Error).message,
      });
    }
  };

export const sendMessage =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          message: "Unauthorized",
        });

        return;
      }

      const conversationId =
        req.params
          .conversationId as string;

      if (
        !mongoose.Types.ObjectId.isValid(
          conversationId,
        )
      ) {
        res.status(400).json({
          message:
            "Invalid conversation ID",
        });

        return;
      }

      const content =
        String(
          req.body.content ||
            "",
        ).trim();

      const senderId =
        req.userId;

      if (!content) {
        res.status(400).json({
          message:
            "Message content is required",
        });

        return;
      }

      if (
        content.length >
        2000
      ) {
        res.status(400).json({
          message:
            "Message is too long",
        });

        return;
      }

      const conversation =
        await Conversation.findById(
          conversationId,
        );

      if (!conversation) {
        res.status(404).json({
          message:
            "Conversation not found",
        });

        return;
      }

      const doctorProfile =
        await DoctorProfile.findById(
          conversation.doctor,
        );

      if (!doctorProfile) {
        res.status(404).json({
          message:
            "Doctor profile not found",
        });

        return;
      }

      const patientId =
        conversation.patient.toString();

      const doctorUserId =
        doctorProfile.user.toString();

      const isParticipant =
        patientId ===
          senderId ||
        doctorUserId ===
          senderId;

      if (!isParticipant) {
        res.status(403).json({
          message:
            "You do not have access to this conversation",
        });

        return;
      }

      const createdMessage =
        await Message.create({
          conversation:
            conversationId,

          sender:
            senderId,

          content,
        });

      conversation.lastMessage =
        content;

      conversation.lastMessageAt =
        new Date();

      await conversation.save();

      const message =
        await Message.findById(
          createdMessage._id,
        ).populate(
          "sender",
          "name email profilePicture",
        );

      const recipientId =
        patientId ===
        senderId
          ? doctorUserId
          : patientId;

      emitToUser(
        recipientId,
        "newMessage",
        {
          conversationId,
          message,
        },
      );

      res.status(201).json({
        message,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to send message",

        error:
          (error as Error).message,
      });
    }
  };

export const getOnlineStatus =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          message: "Unauthorized",
        });

        return;
      }

      const onlineUserIds =
        getOnlineUserIds();

      res.status(200).json({
        onlineUserIds,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to fetch online status",

        error:
          (error as Error).message,
      });
    }
  };