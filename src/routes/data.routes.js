import express from 'express';
import DataController from '../controllers/dataController.js';
import { authMiddleware } from '../services/authService.js';

const router = express.Router();
const dataController = new DataController();

// All operations use POST as requested
router.post('/get-items', dataController.getItems.bind(dataController));
router.post('/get-item', dataController.getItem.bind(dataController));
router.post('/create-item', authMiddleware(), dataController.createItem.bind(dataController));
router.post('/update-item', authMiddleware(), dataController.updateItem.bind(dataController));
router.post('/delete-item', authMiddleware('admin'), dataController.deleteItem.bind(dataController));
router.post('/get-config', dataController.getConfig.bind(dataController));

export default router;
