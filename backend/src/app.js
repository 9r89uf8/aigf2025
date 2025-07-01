/**
 * Express app configuration
 * Sets up middleware, routes, and error handling
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import characterRoutes from './routes/characters.js';
import conversationRoutes from './routes/conversations.js';
import aiRoutes from './routes/ai.js';
import paymentRoutes from './routes/payments.js';
import mediaRoutes from './routes/media.js';
import webhookRoutes from './routes/webhooks.js';
import websocketRoutes from './routes/websocket.js';
import monitoringRoutes from './routes/monitoring.js';
import { createQueueMonitor } from './config/queues.js';
import { authenticate, requireAdmin } from './middleware/auth.js';

/**
 * Create and configure Express app
 * @param {Object} queues - Bull queue instances for monitoring
 * @returns {Express} Configured Express app
 */
export const createApp = (queues = null) => {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-eval'"], // Bull Board needs eval for some functionality
        imgSrc: ["'self'", "data:", "https:"],
        frameAncestors: ["'self'", "http://localhost:3001", "https://localhost:3001"], // Allow frontend to embed
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration
  const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };
  app.use(cors(corsOptions));

  // Note: Basic rate limiting is applied here
  // More specific Redis-based rate limiting is applied on individual routes
  const basicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Higher limit for basic protection
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', basicLimiter);

  // Webhook routes (must be before body parsing)
  app.use('/api/webhooks', webhookRoutes);
  
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    next();
  });

  // Trust proxy
  app.set('trust proxy', 1);

  // Routes
  app.use('/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/characters', characterRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/websocket', websocketRoutes);
  app.use('/api/monitoring', monitoringRoutes);

  // Queue monitoring (admin only)
  if (queues) {
    const queueMonitor = createQueueMonitor();
    
    // Disable CSP for Bull Board (it has its own security)
    app.use('/admin/queues', (req, res, next) => {
      res.removeHeader('Content-Security-Policy');
      res.removeHeader('X-Frame-Options');
      next();
    });
    
    // Store authenticated admin sessions
    const adminSessions = new Set();
    
    // Custom auth middleware for Bull Board
    const bullBoardAuth = async (req, res, next) => {
      console.log('Bull Board Auth - Path:', req.path, 'Query:', req.query);
      
      // Skip authentication for static assets
      if (req.path.includes('/static/') || 
          req.path.endsWith('.css') || 
          req.path.endsWith('.js') || 
          req.path.endsWith('.map') ||
          req.path.endsWith('.png') ||
          req.path.endsWith('.jpg') ||
          req.path.endsWith('.ico') ||
          req.path.endsWith('.woff') ||
          req.path.endsWith('.woff2')) {
        console.log('Skipping auth for static asset:', req.path);
        return next();
      }
      
      // Check for token in query params (initial auth)
      if (req.query.token) {
        try {
          // Manually validate the token using our auth logic
          const { verifyIdToken } = await import('./config/firebase.js');
          const { getUserById } = await import('./services/userService.js');
          
          const decodedToken = await verifyIdToken(req.query.token);
          const user = await getUserById(decodedToken.uid);
          
          if (!user) {
            throw new Error('User not found');
          }
          
          if (!user.roles || !user.roles.includes('admin')) {
            throw new Error('Admin access required');
          }
          
          // Store session for this IP/User-Agent combo
          const sessionKey = `${req.ip}-${req.get('User-Agent')}`;
          adminSessions.add(sessionKey);
          
          // Clean up old sessions after 1 hour
          setTimeout(() => adminSessions.delete(sessionKey), 3600000);
          
          return next();
        } catch (error) {
          console.error('Bull Board auth error:', error);
          return res.status(401).json({ error: 'Unauthorized: ' + error.message });
        }
      }
      
      // Check if this session is already authenticated
      const sessionKey = `${req.ip}-${req.get('User-Agent')}`;
      if (adminSessions.has(sessionKey)) {
        return next();
      }
      
      // No auth found
      return res.status(401).json({ error: 'Unauthorized' });
    };
    
    app.use('/admin/queues', bullBoardAuth, queueMonitor.router);
  }

  // API info endpoint
  app.get('/api', (req, res) => {
    res.json({
      success: true,
      message: 'AI Messaging Platform API',
      version: '1.0.0',
      endpoints: {
        health: {
          base: '/health',
          detailed: '/health/detailed',
          ready: '/health/ready',
          live: '/health/live'
        },
        auth: {
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login',
          profile: 'GET /api/auth/me',
          updateProfile: 'PUT /api/auth/me',
          usage: 'GET /api/auth/usage',
          checkUsername: 'GET /api/auth/check-username/:username'
        },
        users: {
          getById: 'GET /api/users/:uid (Admin)',
          getByUsername: 'GET /api/users/username/:username',
          updatePremium: 'PUT /api/users/:uid/premium (Admin)'
        },
        characters: {
          list: 'GET /api/characters',
          getById: 'GET /api/characters/:id',
          create: 'POST /api/characters (Admin)',
          update: 'PUT /api/characters/:id (Admin)',
          delete: 'DELETE /api/characters/:id (Admin)',
          gallery: 'GET /api/characters/:id/gallery',
          addGalleryItem: 'POST /api/characters/:id/gallery (Admin)',
          removeGalleryItem: 'DELETE /api/characters/:id/gallery/:itemId (Admin)',
          trackView: 'POST /api/characters/:id/gallery/:itemId/view',
          traits: 'GET /api/characters/traits'
        },
        conversations: {
          list: 'GET /api/conversations',
          create: 'POST /api/conversations',
          getById: 'GET /api/conversations/:conversationId',
          messages: 'GET /api/conversations/:conversationId/messages',
          sendMessage: 'POST /api/conversations/:conversationId/messages',
          search: 'GET /api/conversations/:conversationId/search',
          stats: 'GET /api/conversations/:conversationId/stats',
          delete: 'DELETE /api/conversations/:conversationId'
        },
        ai: {
          status: 'GET /api/ai/status',
          models: 'GET /api/ai/models',
          test: 'POST /api/ai/test (Admin)',
          estimateCost: 'POST /api/ai/estimate-cost',
          usage: 'GET /api/ai/usage (Admin)',
          updateSettings: 'PUT /api/ai/characters/:characterId/settings (Admin)'
        },
        payments: {
          config: 'GET /api/payments/config',
          createCheckout: 'POST /api/payments/create-checkout-session',
          createPortal: 'POST /api/payments/create-portal-session',
          subscriptionStatus: 'GET /api/payments/subscription/status',
          cancelSubscription: 'POST /api/payments/subscription/cancel',
          history: 'GET /api/payments/history',
          verifySuccess: 'POST /api/payments/verify-success',
          stripeKey: 'GET /api/payments/stripe-key'
        },
        media: {
          status: 'GET /api/media/status',
          uploadImage: 'POST /api/media/upload/image',
          uploadImages: 'POST /api/media/upload/images',
          uploadGallery: 'POST /api/media/upload/gallery/:characterId (Admin)',
          uploadAudio: 'POST /api/media/upload/audio',
          delete: 'DELETE /api/media/delete',
          signedUrl: 'POST /api/media/signed-url',
          list: 'GET /api/media/list',
          limits: 'GET /api/media/limits'
        },
        webhooks: {
          stripe: 'POST /api/webhooks/stripe',
          health: 'GET /api/webhooks/health'
        },
        websocket: {
          documentation: 'GET /api/websocket',
          connection: 'ws://localhost:3000 (with auth token)'
        }
      }
    });
  });

  // 404 handler
  app.use(notFound);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};

export default createApp; 