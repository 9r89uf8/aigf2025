/**
 * Webhook routes
 * Handles external service webhooks (Stripe, etc.)
 */
import { Router } from 'express';
import { verifyWebhookSignature } from '../config/stripe.js';
import { 
  handleSuccessfulPayment, 
  handleFailedPayment 
} from '../services/paymentService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Stripe webhook endpoint
 * POST /api/webhooks/stripe
 * 
 * Note: This must receive the raw body for signature verification
 */
router.post('/stripe', 
  // Raw body parser for Stripe signature verification
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      logger.warn('Stripe webhook received without signature');
      return res.status(401).json({ error: 'No signature provided' });
    }
    
    let event;
    
    try {
      // Verify webhook signature
      event = verifyWebhookSignature(req.body, signature);
    } catch (error) {
      logger.error('Stripe webhook signature verification failed:', error);
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Log the event
    logger.info('Stripe webhook received', {
      type: event.type,
      id: event.id
    });
    
    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          // Handle successful checkout
          const session = event.data.object;
          
          // Retrieve the session with line items
          const stripe = getStripeClient();
          const fullSession = await stripe.checkout.sessions.retrieve(
            session.id,
            { expand: ['line_items'] }
          );
          
          await handleSuccessfulPayment(fullSession);
          break;
          
        case 'payment_intent.succeeded':
          // Additional handling for successful payment
          logger.info('Payment intent succeeded', {
            paymentIntentId: event.data.object.id,
            amount: event.data.object.amount
          });
          break;
          
        case 'payment_intent.payment_failed':
          // Handle failed payment
          await handleFailedPayment(event.data.object);
          break;
          
        case 'customer.subscription.created':
          logger.info('Subscription created', {
            subscriptionId: event.data.object.id,
            customerId: event.data.object.customer
          });
          break;
          
        case 'customer.subscription.updated':
          logger.info('Subscription updated', {
            subscriptionId: event.data.object.id,
            status: event.data.object.status
          });
          break;
          
        case 'customer.subscription.deleted':
          logger.info('Subscription deleted', {
            subscriptionId: event.data.object.id
          });
          // Handle subscription cancellation
          break;
          
        case 'invoice.payment_succeeded':
          logger.info('Invoice payment succeeded', {
            invoiceId: event.data.object.id,
            customerId: event.data.object.customer
          });
          break;
          
        case 'invoice.payment_failed':
          logger.warn('Invoice payment failed', {
            invoiceId: event.data.object.id,
            customerId: event.data.object.customer
          });
          // Handle failed recurring payment
          break;
          
        default:
          logger.debug('Unhandled Stripe event type', { type: event.type });
      }
      
      // Return success response
      res.json({ received: true });
      
    } catch (error) {
      logger.error('Error processing Stripe webhook:', error);
      // Return success to prevent Stripe from retrying
      res.json({ received: true, error: error.message });
    }
  }
);

/**
 * Health check for webhooks
 * GET /api/webhooks/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoints are active',
    endpoints: {
      stripe: '/api/webhooks/stripe'
    }
  });
});

// Import express for raw body parser
import express from 'express';
import { getStripeClient } from '../config/stripe.js';

export default router; 