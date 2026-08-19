import { Router } from 'express';
import {
  createDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deactivateDoctor,
} from '../controllers/doctorController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

router.get('/', getAllDoctors);
router.get('/:id', getDoctorById);

router.post('/', protect, restrictTo('admin'), createDoctor);
router.put('/:id', protect, restrictTo('admin', 'doctor'), updateDoctor);
router.patch('/:id/deactivate', protect, restrictTo('admin'), deactivateDoctor);

export default router;