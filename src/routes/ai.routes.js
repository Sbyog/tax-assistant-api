import express from 'express';
import AIController from '../controllers/aiController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js'; // Corrected import name
import multer from 'multer'; // Import multer

const router = express.Router();
const aiController = new AIController();

// Configure multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Apply authMiddleware to all AI routes
router.use(verifyFirebaseToken); // Corrected middleware usage

// All endpoints use POST as requested
router.post('/classify', aiController.classifyContent.bind(aiController));
router.post('/extract-entities', aiController.extractEntities.bind(aiController));
router.post('/generate-summary', aiController.generateSummary.bind(aiController));

// New route for OpenAI Assistant interaction
router.post('/assistant/chat', aiController.handleAssistantInteraction.bind(aiController));

// New route for Speech-to-Text
router.post('/speech-to-text', upload.single('audioFile'), aiController.handleSpeechToText.bind(aiController));

export default router;
