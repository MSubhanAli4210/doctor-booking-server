import { Router } from 'express';
import { startConversation, getMyConversations, getMessages, sendMessage, getOnlineStatus } from '../controllers/chatController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/conversations', protect, startConversation);
router.get('/conversations', protect, getMyConversations);
router.get('/conversations/:conversationId/messages', protect, getMessages);
router.post('/conversations/:conversationId/messages', protect, sendMessage);
router.get('/online-status', protect, getOnlineStatus);

export default router;