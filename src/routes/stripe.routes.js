import express from 'express';
import StripeController from '../controllers/stripeController.js';
import { verifyFirebaseToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const stripeController = new StripeController();

// Middleware to get raw body for Stripe webhook verification
const getRawBody = (req, res, next) => {
  if (req.originalUrl === '/payments/webhook' && req.method === 'POST') {
    // Store raw body data for webhook verification
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      next();
    });
  } else {
    next();
  }
};

// Apply the rawBody middleware
router.use(getRawBody);

// Public webhook endpoint - no authentication required
router.post('/webhook', stripeController.handleWebhook.bind(stripeController));

// Protected routes - require authentication
router.use(verifyFirebaseToken);
router.post('/create-checkout-session', stripeController.createCheckoutSession.bind(stripeController));
router.post('/create-customer-portal', stripeController.createCustomerPortal.bind(stripeController));
router.get('/subscription/:customerId', stripeController.getSubscriptionStatus.bind(stripeController));
router.post('/cancel-subscription/:subscriptionId', stripeController.cancelSubscription.bind(stripeController));

export default router;