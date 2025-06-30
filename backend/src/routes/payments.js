/**
 * Payment routes
 * Handles payment-related endpoints
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { redisRateLimiter } from '../middleware/redisRateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isStripeConfigured, PREMIUM_PRICING, formatAmount } from '../config/stripe.js';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  checkPremiumStatus,
  getPaymentHistory,
  cancelPremiumSubscription
} from '../services/paymentService.js';
import cacheService from '../services/cacheService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Get payment configuration and pricing
 * GET /api/payments/config
 */
router.get('/config', asyncHandler(async (req, res) => {
  const configured = isStripeConfigured();
  
  res.json({
    success: true,
    configured,
    pricing: {
      amount: PREMIUM_PRICING.amount,
      currency: PREMIUM_PRICING.currency,
      interval: PREMIUM_PRICING.interval,
      intervalCount: PREMIUM_PRICING.intervalCount,
      formattedPrice: formatAmount(PREMIUM_PRICING.amount),
      description: PREMIUM_PRICING.description,
      features: PREMIUM_PRICING.features
    },
    publishableKey: configured ? process.env.STRIPE_PUBLISHABLE_KEY : null
  });
}));

/**
 * Create checkout session for premium subscription
 * POST /api/payments/create-checkout-session
 */
router.post('/create-checkout-session',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { successUrl, cancelUrl } = req.body;
    
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        error: 'Success and cancel URLs are required'
      });
    }
    
    if (!isStripeConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Payment system not configured'
      });
    }
    
    // Create checkout session
    const session = await createCheckoutSession({
      userId: req.user.uid,
      userEmail: req.user.email,
      successUrl,
      cancelUrl
    });
    
    res.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url,
      expiresAt: session.expiresAt
    });
  })
);

/**
 * Create customer portal session
 * POST /api/payments/create-portal-session
 */
router.post('/create-portal-session',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { returnUrl } = req.body;
    
    if (!returnUrl) {
      return res.status(400).json({
        success: false,
        error: 'Return URL is required'
      });
    }
    
    if (!isStripeConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Payment system not configured'
      });
    }
    
    // Create portal session
    const session = await createCustomerPortalSession(
      req.user.uid,
      returnUrl
    );
    
    res.json({
      success: true,
      url: session.url
    });
  })
);

/**
 * Get premium subscription status
 * GET /api/payments/subscription/status
 */
router.get('/subscription/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const status = await checkPremiumStatus(req.user.uid);
    
    res.json({
      success: true,
      ...status,
      pricing: PREMIUM_PRICING
    });
  })
);

/**
 * Cancel premium subscription
 * POST /api/payments/subscription/cancel
 */
router.post('/subscription/cancel',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const status = await checkPremiumStatus(req.user.uid);
    
    if (!status.isActive) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription to cancel'
      });
    }
    
    await cancelPremiumSubscription(req.user.uid);
    
    res.json({
      success: true,
      message: 'Subscription will expire at the end of the current period',
      expiresAt: status.expiresAt
    });
  })
);

/**
 * Get payment history
 * GET /api/payments/history
 */
router.get('/history',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    
    const history = await getPaymentHistory(req.user.uid, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      ...history
    });
  })
);

/**
 * Verify payment success (for client-side confirmation)
 * POST /api/payments/verify-success
 */
router.post('/verify-success',
  authenticate,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID required'
      });
    }
    
    // Check if session was cached
    const sessionData = await cacheService.get(`checkout_session:${sessionId}`);
    
    if (!sessionData || sessionData.userId !== req.user.uid) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired'
      });
    }
    
    // Check current premium status
    const status = await checkPremiumStatus(req.user.uid);
    
    res.json({
      success: true,
      premiumActivated: status.isActive,
      expiresAt: status.expiresAt
    });
  })
);

/**
 * Get Stripe publishable key (for client SDK)
 * GET /api/payments/stripe-key
 */
router.get('/stripe-key', asyncHandler(async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Payment system not configured'
    });
  }
  
  res.json({
    success: true,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
}));

export default router; 