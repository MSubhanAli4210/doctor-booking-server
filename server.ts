import express, { Application } from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import { initSocket } from "./socket.js";
import authRoutes from "./routes/authRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app: Application = express();
const httpServer = createServer(app);

const clientUrl = process.env.CLIENT_URL
  ?.replace(/^["']|["']$/g, "")
  .replace(/\/$/, "");

const allowedOrigins: string[] = [
  "http://localhost:5173",
  ...(clientUrl ? [clientUrl] : []),
];

const vercelOriginPattern =
  /^https:\/\/doctor-booking-client(?:-[a-z0-9-]+)?\.vercel\.app$/;

const isAllowedOrigin = (origin?: string) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return vercelOriginPattern.test(origin);
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());

connectDB();

initSocket(httpServer, allowedOrigins);

app.get("/", (req, res) => {
  res.send("Doctor Booking API is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);

const PORT: number = Number(process.env.PORT) || 8080;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});