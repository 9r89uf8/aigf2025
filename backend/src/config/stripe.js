/**
 * Stripe configuration
 * Manages Stripe API client and payment settings
 */
import Stripe from 'stripe';
import { config } from './environment.js';
import logger from '../utils/logger.js';

let stripeClient = null;

/**
 * Initialize Stripe client
 * @returns {Stripe} Stripe client instance
 */
export const initializeStripe = () => {
  try {
    if (!config.stripe.secretKey) {
      logger.warn('Stripe secret key not configured');
      return null;
    }

    stripeClient = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
      typescript: false,
      maxNetworkRetries: 3,
      timeout: 30000 // 30 seconds
    });

    logger.info('Stripe client initialized');
    return stripeClient;
  } catch (error) {
    logger.error('Failed to initialize Stripe:', error);
    return null;
  }
};

/**
 * Get Stripe client
 * @returns {Stripe} Stripe client instance
 */
export const getStripeClient = () => {
  if (!stripeClient) {
    stripeClient = initializeStripe();
  }
  return stripeClient;
};

/**
 * Stripe configuration
 */
export const STRIPE_CONFIG = {
  // Product IDs
  products: {
    premium: process.env.STRIPE_PREMIUM_PRODUCT_ID || 'prod_premium_default'
  },
  
  // Price IDs
  prices: {
    premium15Days: process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium_15days'
  },
  
  // Subscription settings
  subscription: {
    trialDays: 0,
    cancelAtPeriodEnd: true, // Don't auto-renew
    metadata: {
      platform: 'ai-messaging'
    }
  },
  
  // Payment methods
  paymentMethods: ['card'],
  
  // Webhook events to handle
  webhookEvents: [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed'
  ]
};

/**
 * Premium pricing details
 */
export const PREMIUM_PRICING = {
  amount: 700, // $7.00 in cents
  currency: 'usd',
  interval: 'days',
  intervalCount: 15,
  description: 'Premium Subscription - 15 days',
  features: [
    'Unlimited messages to all characters',
    'Access to premium character galleries',
    'Priority AI response generation',
    'Audio message support',
    'Advanced character interactions'
  ]
};

/**
 * Create Stripe checkout session config
 * @param {Object} params - Session parameters
 * @returns {Object} Stripe session configuration
 */
export const createCheckoutSessionConfig = ({ 
  userId, 
  userEmail, 
  successUrl, 
  cancelUrl 
}) => {
  return {
    payment_method_types: STRIPE_CONFIG.paymentMethods,
    mode: 'payment', // One-time payment for 15 days
    customer_email: userEmail,
    client_reference_id: userId,
    line_items: [{
      price: STRIPE_CONFIG.prices.premium15Days,
      quantity: 1
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      productType: 'premium_subscription',
      duration: '15_days'
    },
    payment_intent_data: {
      metadata: {
        userId,
        productType: 'premium_subscription'
      }
    },
    // Don't allow promotion codes for now
    allow_promotion_codes: false,
    
    // Billing address collection
    billing_address_collection: 'auto',
    
    // Automatic tax calculation (if configured)
    automatic_tax: {
      enabled: false
    }
  };
};

/**
 * Create customer portal session config
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - URL to return to
 * @returns {Object} Portal session configuration
 */
export const createPortalSessionConfig = (customerId, returnUrl) => {
  return {
    customer: customerId,
    return_url: returnUrl
  };
};

/**
 * Verify webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Object} Parsed event object
 */
export const verifyWebhookSignature = (payload, signature) => {
  const stripe = getStripeClient();
  const webhookSecret = config.stripe.webhookSecret;
  
  if (!stripe || !webhookSecret) {
    throw new Error('Stripe not properly configured for webhooks');
  }
  
  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    logger.error('Webhook signature verification failed:', error);
    throw new Error('Invalid webhook signature');
  }
};

/**
 * Check if Stripe is configured
 * @returns {boolean} True if configured
 */
export const isStripeConfigured = () => {
  return !!(
    config.stripe.secretKey && 
    config.stripe.publishableKey &&
    config.stripe.webhookSecret
  );
};

/**
 * Format amount for display
 * @param {number} amount - Amount in cents
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount
 */
export const formatAmount = (amount, currency = 'usd') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  });
  
  return formatter.format(amount / 100);
};

/**
 * Calculate premium expiration date
 * @param {Date} startDate - Start date
 * @returns {Date} Expiration date
 */
export const calculatePremiumExpiration = (startDate = new Date()) => {
  const expirationDate = new Date(startDate);
  expirationDate.setDate(expirationDate.getDate() + 15);
  return expirationDate;
};

export default {
  initializeStripe,
  getStripeClient,
  isStripeConfigured,
  STRIPE_CONFIG,
  PREMIUM_PRICING,
  createCheckoutSessionConfig,
  createPortalSessionConfig,
  verifyWebhookSignature,
  formatAmount,
  calculatePremiumExpiration
}; 