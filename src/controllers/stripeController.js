import * as stripeService from '../services/stripeService.js';
import admin from 'firebase-admin';
import { createUser } from '../services/authService.js'; // <-- Import createUser

class StripeController {
  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(req, res) {
    try {
      const { userId, email: requestEmail, firstName, lastName, successUrl, cancelUrl } = req.body; // Added firstName, lastName
      let stripeCustomerId = null;
      let userEmail = requestEmail; // Use email from request body first
      let userDisplayName = null;

      if (firstName && lastName) {
        userDisplayName = `${firstName} ${lastName}`.trim();
      } else if (firstName) {
        userDisplayName = firstName.trim();
      }

      if (!successUrl || !cancelUrl) {
        return res.status(400).json({ success: false, error: 'successUrl and cancelUrl are required' });
      }

      if (userId) {
        try {
          const db = admin.firestore();
          const userDocRef = db.collection('users').doc(userId);
          const userDoc = await userDocRef.get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.stripeCustomerId) {
              stripeCustomerId = userData.stripeCustomerId;
              console.log(`Using existing Stripe customer ID: ${stripeCustomerId} for user: ${userId}`);
            }
            if (!userEmail && userData.email) { // If email wasn't in request, use from Firestore
              userEmail = userData.email;
            }
            // If no Stripe customer ID yet, but we have an email, create Stripe customer
            if (!stripeCustomerId && userEmail) {
              const customerResult = await stripeService.createCustomer(
                userEmail, 
                userData.displayName || userDisplayName || null, // Use existing displayName or new one
                { firebaseUserId: userId }
              );
              if (customerResult.success) {
                stripeCustomerId = customerResult.customerId;
                await userDocRef.update({
                  stripeCustomerId: stripeCustomerId,
                  stripeCustomerCreatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Created new Stripe customer: ${stripeCustomerId} for existing user: ${userId} and updated Firestore.`);
              }
            }
          } else {
            // User document not found for userId, attempt to create it if email is available
            console.warn(`User document not found for userId: ${userId}.`);
            if (userEmail) { // userEmail is from req.body.email or potentially null if not provided
              console.log(`Attempting to create Firestore user ${userId} with email ${userEmail}.`);
              try {
                // Create user in Firestore first, now passing displayName
                await createUser(userId, userEmail, userDisplayName, null);
                console.log(`Successfully created user ${userId} in Firestore with displayName: ${userDisplayName}.`);

                // Now create the Stripe customer for the newly created Firestore user
                const customerResult = await stripeService.createCustomer(
                  userEmail,
                  userDisplayName, // Pass constructed displayName
                  { firebaseUserId: userId }
                );

                if (customerResult.success) {
                  stripeCustomerId = customerResult.customerId;
                  // Update the newly created Firestore user document with the Stripe customer ID
                  await userDocRef.set({ 
                    stripeCustomerId: stripeCustomerId,
                    stripeCustomerCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    // displayName is set by createUser, ensure other fields are merged if necessary
                  }, { merge: true }); 
                  console.log(`Created Stripe customer: ${stripeCustomerId} for newly created user: ${userId} and updated Firestore.`);
                } else {
                  console.error(`Failed to create Stripe customer for newly created user ${userId}:`, customerResult.error);
                  return res.status(500).json({ success: false, error: 'Failed to create Stripe customer for new user.' });
                }
              } catch (createError) {
                console.error(`Error creating Firestore user ${userId} or subsequent Stripe customer creation/update:`, createError);
                if (createError.message && createError.message.includes('already exists')) {
                     console.warn(`User ${userId} already exists, likely created by another process. Will attempt to proceed if possible.`);
                } else {
                    return res.status(500).json({ success: false, error: 'Failed to initialize new user for subscription.' });
                }
              }
            } else {
              console.error(`User document for ${userId} not found and no email provided in request. Cannot create user or Stripe customer.`);
              return res.status(400).json({ success: false, error: 'User not found and email not provided to create one.' });
            }
          }
        } catch (error) {
          console.error(`Error processing customer for userId: ${userId}`, error);
        }
      }

      if (!stripeCustomerId && !userEmail) {
        return res.status(400).json({ success: false, error: 'User ID or Email is required to create a checkout session if customer does not exist.' });
      }

      const checkoutResult = await stripeService.createCheckoutSession(stripeCustomerId, userEmail, successUrl, cancelUrl);

      if (checkoutResult.success) {
        res.json(checkoutResult);
      } else {
        res.status(500).json(checkoutResult);
      }
    } catch (error) {
      console.error('Error in createCheckoutSession controller:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Create a customer portal session
   */
  async createCustomerPortal(req, res) {
    try {
      const { userId, customerId, returnUrl } = req.body; // customerId is optional if userId is provided

      if (!returnUrl) {
        return res.status(400).json({
          success: false,
          error: 'Return URL is required'
        });
      }

      let stripeCustomerId = customerId; // Use direct customerId if provided

      // If Firebase userId is provided and we don't have a direct stripeCustomerId, look it up
      if (userId && !stripeCustomerId) {
        try {
          const db = admin.firestore();
          const userDoc = await db.collection('users').doc(userId).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.stripeCustomerId) {
              stripeCustomerId = userData.stripeCustomerId;
              console.log(`Portal: Using existing Stripe customer ID: ${stripeCustomerId} for user: ${userId}`);
            } else {
              // User exists but has no Stripe customer ID (e.g., never subscribed)
              console.error(`Portal: User ${userId} does not have an associated Stripe customer ID.`);
              return res.status(400).json({
                success: false,
                error: 'User does not have an associated Stripe customer ID to access the portal. Please subscribe first.'
              });
            }
          } else {
            // User not found in Firestore
            console.error(`Portal: User ${userId} not found.`);
            return res.status(404).json({
              success: false,
              error: 'User not found.'
            });
          }
        } catch (error) {
          console.error(`Portal: Error retrieving Stripe customer ID for userId: ${userId}`, error);
          return res.status(500).json({
            success: false,
            error: 'Failed to retrieve Stripe customer information for the portal.'
          });
        }
      }
      
      // If after all checks, we still don't have a stripeCustomerId
      if (!stripeCustomerId) {
        console.error(`Portal: Stripe customer ID is required to create a portal session.`);
        return res.status(400).json({
          success: false,
          error: 'Stripe customer ID is required to create a portal session. Please ensure the user has an active subscription or customer record.'
        });
      }

      // Now, call the service to create the portal session
      const result = await stripeService.createCustomerPortalSession(
        stripeCustomerId,
        returnUrl
      );

      if (!result.success) {
        return res.status(400).json(result); // Pass along error from stripeService
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create customer portal session'
      });
    }
  }

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhook(req, res) {
    try {
      console.log('🔔 Webhook received from Stripe');
      
      // Get the signature from the Stripe signature header
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        console.error('❌ Missing Stripe signature in webhook');
        return res.status(400).json({
          success: false,
          error: 'Missing Stripe signature'
        });
      }
      
      console.log('✅ Stripe signature found in headers');

      // Process the event
      const result = await stripeService.handleWebhookEvent(
        req.rawBody, // This needs to be the raw body
        signature
      );

      if (!result.success) {
        console.error('❌ Failed to handle webhook event:', result.error);
        return res.status(400).json({ success: false, error: result.error });
      }

      const event = result.event;
      console.log(`📣 Webhook event type: ${event.type}`);
      console.log(`📦 Webhook event data:`, JSON.stringify(event.data.object, null, 2));
      
      const db = admin.firestore();

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed': {
          console.log('💰 Processing checkout.session.completed event');
          
          const session = event.data.object;
          const customerId = session.customer;
          const subscriptionId = session.subscription;
          const userEmail = session.customer_details ? session.customer_details.email : null;

          console.log(`📧 Customer email from checkout: ${userEmail}`);
          console.log(`🆔 Stripe customer ID: ${customerId}`);
          console.log(`📝 Stripe subscription ID: ${subscriptionId}`);

          // Find user by email or customerId in your database
          if (userEmail) {
            console.log(`🔍 Looking up user with email: ${userEmail} in Firestore`);
            // Update user's subscription info in your database
            const usersRef = db.collection('users');
            const snapshot = await usersRef.where('email', '==', userEmail).limit(1).get();
            
            if (!snapshot.empty) {
              const userDoc = snapshot.docs[0];
              const userData = userDoc.data();
              console.log(`✅ Found user in Firestore: ${userDoc.id}, current data:`, userData);
              
              console.log(`📝 Updating user with Stripe customer and subscription IDs`);
              await userDoc.ref.update({
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                subscriptionCreatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`✅ User Stripe IDs and creation timestamp updated in Firestore.`);
            } else {
              console.error(`❌ No user found with email: ${userEmail} in Firestore`);
              
              // Try checking if any user has this Stripe customer ID already
              console.log(`🔍 Searching for any user with Stripe customer ID: ${customerId}`);
              const customerSnapshot = await usersRef.where('stripeCustomerId', '==', customerId).limit(1).get();
              
              if (!customerSnapshot.empty) {
                const customerUserDoc = customerSnapshot.docs[0];
                console.log(`✅ Found user by Stripe ID: ${customerUserDoc.id}`);
                console.log(`📝 Updating subscription ID for this user`);
                await customerUserDoc.ref.update({
                  stripeSubscriptionId: subscriptionId,
                  subscriptionCreatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`✅ User subscription ID and creation timestamp updated in Firestore`);
              } else {
                console.error(`❌ No user found with this Stripe customer ID either`);
              }
            }
          } else {
            console.error(`❌ No customer email found in checkout session`);
          }
          break;
        }
        
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const status = subscription.status;
          const customerId = subscription.customer;
          
          console.log(`🔄 Processing customer.subscription.updated event`);
          console.log(`🆔 Stripe customer ID: ${customerId}`);
          console.log(`📜 Subscription status: ${status}`);
          
          // Update subscription status in your database
          const usersRef = db.collection('users');
          const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).limit(1).get();
          
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            console.log(`✅ Found user in Firestore: ${userDoc.id}, current data:`, userData);
            
            console.log(`📝 Updating subscription status for user`);
            await userDoc.ref.update({
              subscriptionStatus: status,
              subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Subscription status updated in Firestore`);
          } else {
            console.error(`❌ No user found with Stripe customer ID: ${customerId}`);
          }
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer;
          
          console.log(`❌ Processing customer.subscription.deleted event`);
          console.log(`🆔 Stripe customer ID: ${customerId}`);
          
          // Update subscription status in your database
          const usersRef = db.collection('users');
          const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).limit(1).get();
          
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            console.log(`✅ Found user in Firestore: ${userDoc.id}, current data:`, userData);
            
            console.log(`📝 Updating subscription status for user`);
            await userDoc.ref.update({
              subscriptionStatus: 'canceled',
              subscriptionCanceledAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Subscription status updated in Firestore`);
          } else {
            console.error(`❌ No user found with Stripe customer ID: ${customerId}`);
          }
          break;
        }
      }

      // Return a success response
      console.log('✅ Webhook processed successfully');
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to handle webhook'
      });
    }
  }

  /**
   * Get subscription status for a user
   */
  async getSubscriptionStatus(req, res) {
    try {
      const { customerId } = req.params;
      
      if (!customerId) {
        return res.status(400).json({
          success: false,
          error: 'Customer ID is required'
        });
      }

      let stripeCustomerIdToUse = customerId;
      let isFirebaseId = false;

      // Check if the ID is likely a Firebase user ID (heuristic: length or no 'cus_' prefix)
      // A more robust check might involve trying to parse it as a Firebase UID if your format is consistent
      if (!customerId.startsWith('cus_') && customerId.length > 20) { 
        isFirebaseId = true;
      }

      if (isFirebaseId) {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(customerId).get();
        
        if (!userDoc.exists) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }
        
        const userData = userDoc.data();
        const firestoreStripeCustomerId = userData.stripeCustomerId;
        
        if (!firestoreStripeCustomerId) {
          return res.status(200).json({
            success: true,
            status: 'none',
            subscriptions: [],
            trialEndDate: null // Add trialEndDate here as well
          });
        }
        stripeCustomerIdToUse = firestoreStripeCustomerId;
      }
      
      // Use the determined Stripe customer ID for the API call
      const result = await stripeService.getSubscriptions(stripeCustomerIdToUse);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      let status = 'none';
      let trialEndDate = null;
      let activeSubscription = null;

      if (result.subscriptions && result.subscriptions.length > 0) {
        // Find the most relevant subscription (e.g., active or trialing)
        // This logic might need adjustment based on how you handle multiple subscriptions
        activeSubscription = result.subscriptions.find(sub => sub.status === 'active' || sub.status === 'trialing') || result.subscriptions[0];
        status = activeSubscription.status;

        if (status === 'trialing' && activeSubscription.trial_end) {
          trialEndDate = new Date(activeSubscription.trial_end * 1000).toISOString();
        }
      }

      return res.status(200).json({
        success: true,
        status,
        trialEndDate, // Include trialEndDate in the response
        subscriptions: result.subscriptions // Return all subscriptions for context if needed
      });

    } catch (error) {
      console.error('Error getting subscription status:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get subscription status'
      });
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(req, res) {
    try {
      const { subscriptionId } = req.params;
      
      if (!subscriptionId) {
        return res.status(400).json({
          success: false,
          error: 'Subscription ID is required'
        });
      }

      const result = await stripeService.cancelSubscription(subscriptionId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel subscription'
      });
    }
  }
}

export default StripeController;