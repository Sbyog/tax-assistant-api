import express from 'express';
import AuthController from '../controllers/authController.js';
import * as authService from '../services/authService.js'; // Import all service functions
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';

const router = express.Router();
// Pass the authService module to the controller
const authController = new AuthController(authService);

// All endpoints use POST regardless of operation type
router.post('/verify-token', authController.verifyUserToken.bind(authController));
router.post('/check-permissions', authController.checkUserPermissions.bind(authController));
router.post('/user-info', authController.getUserInfo.bind(authController));

// New Endpoints - now protected by verifyFirebaseToken middleware
router.post('/users/exists', verifyFirebaseToken, authController.checkUserExists.bind(authController));
router.post('/users/create', verifyFirebaseToken, authController.createUser.bind(authController));
router.post('/users/last-login', verifyFirebaseToken, authController.updateUserLastLogin.bind(authController));
router.post('/users/data', verifyFirebaseToken, authController.getUserData.bind(authController));

// New endpoint for updating user data - changed to POST
router.post('/users/update', verifyFirebaseToken, authController.updateUserData.bind(authController));

export default router;
