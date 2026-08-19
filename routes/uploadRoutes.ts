import { Router } from 'express';
import { uploadProfilePicture } from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = Router();

router.post('/profile-picture', protect, upload.single('image'), uploadProfilePicture);

export default router;