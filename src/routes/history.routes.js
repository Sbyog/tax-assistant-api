import express from 'express';
import historyController from '../controllers/historyController.js'; // Import the controller
import { verifyFirebaseToken } from '../middleware/authMiddleware.js'; // Changed from 'protect' to 'verifyFirebaseToken'

const router = express.Router();

// POST /history/save
// Calls saveConversation method from historyController
router.post('/save', verifyFirebaseToken, historyController.saveConversation.bind(historyController));

// POST /history/list
// Calls listConversations method from historyController
router.post('/list', verifyFirebaseToken, historyController.listConversations.bind(historyController));

// POST /history/messages
// Calls getConversationMessages method from historyController
router.post('/messages', verifyFirebaseToken, historyController.getConversationMessages.bind(historyController));

// POST /history/delete
// Calls deleteConversation method from historyController
router.post('/delete', verifyFirebaseToken, historyController.deleteConversation.bind(historyController));

export default router;