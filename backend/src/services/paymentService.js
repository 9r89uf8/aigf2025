/**
 * Payment Service
 * Handles Stripe payment processing and subscription management
 */
import { 
  getStripeClient, 
  createCheckoutSessionConfig,
  createPortalSessionConfig,
  calculatePremiumExpiration,
  PREMIUM_PRICING 
} from '../config/stripe.js';
import { updateUserPremiumStatus, getUserById } from './userService.js';
import cacheService from './cacheService.js';
import { notifyUser } from '../handlers/socketManager.js';
import logger from '../utils/logger.js';

/**
 * Create checkout session for premium subscription
 * @param {Object} params - Checkout parameters
 * @returns {Promise<Object>} Checkout session
 */
export const createCheckoutSession = async ({ 
  userId, 
  userEmail, 
  successUrl, 
  cancelUrl 
}) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      throw new Error('Stripe not configured');
    }
    
    // Check if user already has active premium
    const existingPremium = await checkExistingPremium(userId);
    if (existingPremium.isActive) {
      throw new Error('User already has active premium subscription');
    }
    
    // Create checkout session
    const sessionConfig = createCheckoutSessionConfig({
      userId,
      userEmail,
      successUrl,
      cancelUrl
    });
    
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    // Cache session ID for verification
    await cacheService.set(
      `checkout_session:${session.id}`,
      { userId, userEmail },
      3600 // 1 hour
    );
    
    logger.info('Checkout session created', {
      sessionId: session.id,
      userId,
      amount: PREMIUM_PRICING.amount
    });
    
    return {
      sessionId: session.id,
      url: session.url,
      expiresAt: new Date(session.expires_at * 1000)
    };
    
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Create customer portal session
 * @param {string} userId - User ID
 * @param {string} returnUrl - URL to return to
 * @returns {Promise<Object>} Portal session
 */
export const createCustomerPortalSession = async (userId, returnUrl) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      throw new Error('Stripe not configured');
    }
    
    // Get user's Stripe customer ID
    const customerId = await getUserStripeCustomerId(userId);
    if (!customerId) {
      throw new Error('No Stripe customer found for user');
    }
    
    // Create portal session
    const sessionConfig = createPortalSessionConfig(customerId, returnUrl);
    const session = await stripe.billingPortal.sessions.create(sessionConfig);
    
    logger.info('Customer portal session created', {
      userId,
      customerId
    });
    
    return {
      url: session.url
    };
    
  } catch (error) {
    logger.error('Error creating portal session:', error);
    throw error;
  }
};

/**
 * Handle successful payment
 * @param {Object} session - Stripe checkout session
 * @returns {Promise<void>}
 */
export const handleSuccessfulPayment = async (session) => {
  try {
    const { client_reference_id: userId, customer_email: email } = session;
    
    if (!userId) {
      logger.error('No user ID in checkout session');
      return;
    }
    
    // Calculate expiration date
    const expirationDate = calculatePremiumExpiration();
    
    // Update user premium status
    await updateUserPremiumStatus(userId, {
      isPremium: true,
      premiumExpiresAt: expirationDate,
      stripeCustomerId: session.customer,
      lastPaymentAmount: session.amount_total,
      lastPaymentDate: new Date()
    });
    
    // Clear user cache
    await cacheService.del(`user:${userId}`);
    
    // Record payment in database
    await recordPayment({
      userId,
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
      amount: session.amount_total,
      currency: session.currency,
      status: 'succeeded',
      email
    });
    
    // Send confirmation notification
    await sendPremiumActivationNotification(userId, expirationDate);
    
    logger.info('Premium subscription activated', {
      userId,
      expiresAt: expirationDate,
      amount: session.amount_total
    });
    
  } catch (error) {
    logger.error('Error handling successful payment:', error);
    throw error;
  }
};

/**
 * Handle failed payment
 * @param {Object} paymentIntent - Stripe payment intent
 * @returns {Promise<void>}
 */
export const handleFailedPayment = async (paymentIntent) => {
  try {
    const { userId } = paymentIntent.metadata;
    
    if (!userId) {
      logger.error('No user ID in payment intent');
      return;
    }
    
    // Record failed payment
    await recordPayment({
      userId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'failed',
      failureReason: paymentIntent.last_payment_error?.message
    });
    
    // Notify user
    notifyUser(userId, 'payment_failed', {
      reason: paymentIntent.last_payment_error?.message || 'Payment failed'
    });
    
    logger.warn('Payment failed', {
      userId,
      paymentIntentId: paymentIntent.id,
      reason: paymentIntent.last_payment_error?.message
    });
    
  } catch (error) {
    logger.error('Error handling failed payment:', error);
  }
};

/**
 * Check user's premium subscription status
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Subscription status
 */
export const checkPremiumStatus = async (userId) => {
  try {
    // Check cache first
    const cacheKey = `premium_status:${userId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Get user data
    const user = await getUserById(userId);
    
    const now = new Date();
    const isActive = user.isPremium && 
      user.premiumExpiresAt && 
      new Date(user.premiumExpiresAt) > now;
    
    const status = {
      isActive,
      isPremium: user.isPremium,
      expiresAt: user.premiumExpiresAt,
      daysRemaining: isActive 
        ? Math.ceil((new Date(user.premiumExpiresAt) - now) / (1000 * 60 * 60 * 24))
        : 0
    };
    
    // Cache for 5 minutes
    await cacheService.set(cacheKey, status, 300);
    
    return status;
  } catch (error) {
    logger.error('Error checking premium status:', error);
    throw error;
  }
};

/**
 * Get payment history for user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Payment history
 */
export const getPaymentHistory = async (userId, options = {}) => {
  const { limit = 10, offset = 0 } = options;
  
  try {
    const payments = await getPaymentsByUserId(userId, { limit, offset });
    
    return {
      payments,
      total: payments.length,
      limit,
      offset,
      hasMore: payments.length === limit
    };
  } catch (error) {
    logger.error('Error getting payment history:', error);
    throw error;
  }
};

/**
 * Cancel premium subscription
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const cancelPremiumSubscription = async (userId) => {
  try {
    // Update user status to expire at end of period
    await updateUserPremiumStatus(userId, {
      cancelledAt: new Date()
    });
    
    // Clear cache
    await cacheService.del(`premium_status:${userId}`);
    
    // Notify user
    notifyUser(userId, 'subscription_cancelled', {
      expiresAt: (await getUserById(userId)).premiumExpiresAt
    });
    
    logger.info('Premium subscription cancelled', { userId });
    
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    throw error;
  }
};

/**
 * Check for expiring subscriptions (to be called by cron)
 * @returns {Promise<void>}
 */
export const checkExpiringSubscriptions = async () => {
  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    // Find users with subscriptions expiring in 3 days
    const expiringUsers = await getUsersWithExpiringPremium(threeDaysFromNow);
    
    for (const user of expiringUsers) {
      // Send reminder notification
      notifyUser(user.uid, 'subscription_expiring', {
        expiresAt: user.premiumExpiresAt,
        daysRemaining: 3
      });
      
      // You could also send an email here
    }
    
    logger.info('Expiring subscription check completed', {
      usersNotified: expiringUsers.length
    });
    
  } catch (error) {
    logger.error('Error checking expiring subscriptions:', error);
  }
};

/**
 * Private helper functions
 */

const checkExistingPremium = async (userId) => {
  const status = await checkPremiumStatus(userId);
  return status;
};

const getUserStripeCustomerId = async (userId) => {
  const user = await getUserById(userId);
  return user.stripeCustomerId;
};

const recordPayment = async (paymentData) => {
  // TODO: Implement payment recording in Firestore
  logger.debug('Payment recorded', paymentData);
};

const sendPremiumActivationNotification = async (userId, expirationDate) => {
  // Send real-time notification
  notifyUser(userId, 'premium_activated', {
    expiresAt: expirationDate,
    features: PREMIUM_PRICING.features
  });
  
  // TODO: Send confirmation email
};

const getPaymentsByUserId = async (userId, options) => {
  // TODO: Implement payment history retrieval from Firestore
  return [];
};

const getUsersWithExpiringPremium = async (beforeDate) => {
  // TODO: Implement query for users with expiring premium
  return [];
};

export default {
  createCheckoutSession,
  createCustomerPortalSession,
  handleSuccessfulPayment,
  handleFailedPayment,
  checkPremiumStatus,
  getPaymentHistory,
  cancelPremiumSubscription,
  checkExpiringSubscriptions
}; 