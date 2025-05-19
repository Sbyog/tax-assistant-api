import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Stripe with API key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
const STRIPE_TRIAL_PERIOD_DAYS = process.env.STRIPE_TRIAL_PERIOD_DAYS; // <-- Add this

// Check if Stripe secret key is available
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set in environment variables');
}

/**
 * Create a Checkout Session for subscription
 * @param {string} customerId - The Stripe customer ID (optional)
 * @param {string} email - The customer's email address
 * @param {string} successUrl - URL to redirect after successful payment
 * @param {string} cancelUrl - URL to redirect if user cancels
 * @returns {Promise<Object>} Stripe checkout session
 */
const createCheckoutSession = async (customerId, email, successUrl, cancelUrl) => {
  try {
    const sessionConfig = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: SUBSCRIPTION_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: { // <-- Add subscription_data object
        // trial_from_plan: undefined, // Explicitly manage trial here, don't rely on price's default trial
      }
    };

    // Add trial period if configured
    if (STRIPE_TRIAL_PERIOD_DAYS && parseInt(STRIPE_TRIAL_PERIOD_DAYS) > 0) {
      sessionConfig.subscription_data.trial_period_days = parseInt(STRIPE_TRIAL_PERIOD_DAYS);
      console.log(`Applying trial period of ${STRIPE_TRIAL_PERIOD_DAYS} days to new subscription.`);
    }

    // If we have a customer ID, use it
    if (customerId) {
      sessionConfig.customer = customerId;
    } else if (email) {
      // Otherwise, let Stripe create a new customer with this email
      sessionConfig.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return { success: true, sessionId: session.id, url: session.url };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a new customer in Stripe
 * @param {string} email - Customer email
 * @param {string} name - Customer name (optional)
 * @param {Object} metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Stripe customer object or error
 */
const createCustomer = async (email, name = null, metadata = {}) => {
  try {
    const customerData = {
      email,
      metadata: {
        ...metadata,
      },
    };

    if (name) {
      customerData.name = name;
    }

    const customer = await stripe.customers.create(customerData);
    return { success: true, customerId: customer.id, customer };
  } catch (error) {
    console.error('Error creating customer:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get customer details from Stripe
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Object>} Customer details
 */
const getCustomer = async (customerId) => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return { success: true, customer };
  } catch (error) {
    console.error('Error retrieving customer:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a customer's subscriptions
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Object>} List of subscriptions
 */
const getSubscriptions = async (customerId) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
    });
    return { success: true, subscriptions: subscriptions.data };
  } catch (error) {
    console.error('Error retrieving subscriptions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancel a subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Result of the cancellation
 */
const cancelSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return { success: true, subscription };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Handle Stripe webhook events
 * @param {string} rawBody - Raw request body
 * @param {string} signature - Stripe signature from headers
 * @returns {Promise<Object>} Processed event
 */
const handleWebhookEvent = async (rawBody, signature) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );

    return { success: true, event };
  } catch (error) {
    console.error('Error handling webhook event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a customer portal session for subscription management
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - URL to return to after using the portal
 * @returns {Promise<Object>} Portal session URL
 */
const createCustomerPortalSession = async (customerId, returnUrl) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID || undefined
    });
    return { success: true, url: session.url };
  } catch (error) {
    // If the error is about missing configuration, provide more specific error message
    if (error.type === 'StripeInvalidRequestError' && 
        error.raw.message.includes('No configuration provided')) {
      console.error('Customer Portal configuration not found. Please configure the Customer Portal in your Stripe Dashboard:', error);
      return { 
        success: false, 
        error: 'Customer Portal is not configured. Please contact support.' 
      };
    }
    console.error('Error creating portal session:', error);
    return { success: false, error: error.message };
  }
};

export {
  createCheckoutSession,
  createCustomer,
  getCustomer,
  getSubscriptions,
  cancelSubscription,
  handleWebhookEvent,
  createCustomerPortalSession }