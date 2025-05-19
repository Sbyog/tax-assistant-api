import express from 'express';
import UtilityController from '../controllers/utilityController.js';
import { authMiddleware } from '../services/authService.js';

const router = express.Router();
const utilityController = new UtilityController();

// All operations use POST
router.post('/health-check', utilityController.healthCheck.bind(utilityController));
router.post('/refresh-cache', authMiddleware('admin'), utilityController.refreshCache.bind(utilityController));
router.post('/system-info', authMiddleware('admin'), utilityController.getSystemInfo.bind(utilityController));

export default router;
