import { Router } from 'express';
import {
  bookAppointment,
  processPayment,
  getMyAppointments,
  getDoctorAppointments,
  updateAppointmentStatus,
  cancelAppointment,
  getAllAppointments,
} from '../controllers/appointmentController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

router.post('/', protect, restrictTo('patient'), bookAppointment);
router.post('/:id/pay', protect, restrictTo('patient'), processPayment);
router.get('/my', protect, restrictTo('patient'), getMyAppointments);
router.get('/doctor', protect, restrictTo('doctor'), getDoctorAppointments);
router.patch('/:id/status', protect, restrictTo('doctor'), updateAppointmentStatus);
router.patch('/:id/cancel', protect, restrictTo('patient'), cancelAppointment);
router.get('/', protect, restrictTo('admin'), getAllAppointments);

export default router;