import express, { Application } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import { initSocket } from './socket.js';

import authRoutes from './routes/authRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import chatRoutes from './routes/chatRoutes.js';

dotenv.config();

const app: Application = express();
const httpServer = createServer(app);

const allowedOrigins: string[] = ['http://localhost:5173'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

connectDB();
initSocket(httpServer, allowedOrigins);

app.get('/', (req, res) => {
  res.send('Doctor Booking API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);

const PORT: number = Number(process.env.PORT) || 8080;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});