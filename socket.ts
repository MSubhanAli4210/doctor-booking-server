import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";

interface DecodedToken {
  userId: string;
  role: string;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

let io: SocketIOServer;

// Tracks currently connected userIds — a user can have multiple tabs/devices open,
// so we count connections per user rather than a simple boolean
const onlineUsers = new Map<string, number>();

export const initSocket = (
  httpServer: HTTPServer,
  allowedOrigins: string[],
): void => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Not authorized, no token provided"));
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string,
      ) as DecodedToken;
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error("Not authorized, invalid or expired token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: user ${socket.userId} (${socket.userRole})`);

    if (socket.userId) {
      socket.join(socket.userId);

      const currentCount = onlineUsers.get(socket.userId) || 0;
      onlineUsers.set(socket.userId, currentCount + 1);

      if (currentCount === 0) {
        io.emit("userOnline", { userId: socket.userId });
      }
    }

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: user ${socket.userId}`);

      if (socket.userId) {
        const currentCount = onlineUsers.get(socket.userId) || 0;
        const newCount = Math.max(currentCount - 1, 0);

        if (newCount === 0) {
          onlineUsers.delete(socket.userId);
          io.emit("userOffline", { userId: socket.userId });
        } else {
          onlineUsers.set(socket.userId, newCount);
        }
      }
    });
  });
};

export const emitToUser = (
  userId: string,
  event: string,
  data: unknown,
): void => {
  if (!io) return;
  io.to(userId).emit(event, data);
};

export const isUserOnline = (userId: string): boolean => {
  return onlineUsers.has(userId);
};

export const getOnlineUserIds = (): string[] => {
  return Array.from(onlineUsers.keys());
};

export const getIO = (): SocketIOServer => io;
