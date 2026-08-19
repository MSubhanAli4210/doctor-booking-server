import { Router } from 'express';
import { createReview, getDoctorReviews, deleteReview } from '../controllers/reviewController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

router.post('/', protect, restrictTo('patient'), createReview);
router.get('/doctor/:doctorId', getDoctorReviews);
router.delete('/:id', protect, restrictTo('patient'), deleteReview);

export default router;