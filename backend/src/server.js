/**
 * Main server file
 * Initializes services and starts the Express server
 */
import { createApp } from './app.js';
import { config } from './config/environment.js';
import { initializeFirebase } from './config/firebase.js';
import { initializeRedis, closeRedisConnections } from './config/redis.js';
import { initializeQueues, closeAllQueues } from './config/queues.js';
import { initializeSocket } from './config/socket.js';
import { registerSocketHandlers } from './handlers/socketManager.js';
import { initializeDeepSeek } from './config/deepseek.js';
import { processAIResponse } from './queues/aiResponseProcessor.js';
import { initializeCleanup } from './services/conversationStateService/index.js';
import { initializeStripe } from './config/stripe.js';
import { initializeStorage } from './config/storage.js';
import { validateEnvironment } from './utils/validateEnv.js';
import logger from './utils/logger.js';

/**
 * Initialize services and start server
 */
const startServer = async () => {
  try {
    // Validate environment variables
    logger.info('Validating environment variables...');
    const envValidation = validateEnvironment(true);
    logger.info('Environment validated successfully', {
      features: envValidation.features
    });
    
    // Initialize Firebase Admin SDK
    logger.info('Initializing Firebase Admin SDK...');
    initializeFirebase();
    
    // Initialize Redis
    logger.info('Initializing Redis...');
    initializeRedis();
    
    // Initialize DeepSeek
    logger.info('Initializing DeepSeek...');
    initializeDeepSeek();
    
    // Initialize Stripe
    logger.info('Initializing Stripe...');
    initializeStripe();
    
    // Initialize Storage
    logger.info('Initializing Storage...');
    initializeStorage();
    
    // Initialize queues
    logger.info('Initializing job queues...');
    const queues = initializeQueues();
    
    // Make queues globally accessible for queue processing
    global.queues = queues;
    
    // Set up queue processors
    logger.info('Setting up queue processors...');
    queues.aiQueue.process('generate-response', processAIResponse);
    logger.info('AI response processor registered');
    
    // Create Express app with queue monitoring
    const app = createApp(queues);
    
    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Server started successfully`, {
        port: config.port,
        environment: config.nodeEnv,
        nodeVersion: process.version,
        services: {
          firebase: 'ready',
          redis: 'ready',
          deepseek: config.deepseek.apiKey ? 'ready' : 'not configured',
          stripe: config.stripe.secretKey ? 'ready' : 'not configured',
          storage: config.firebase.projectId ? 'ready' : 'not configured',
          queues: Object.keys(queues).join(', ')
        }
      });
      logger.info(`Health check available at http://localhost:${config.port}/health`);
    });
    
    // Initialize Socket.io
    logger.info('Initializing Socket.io...');
    const io = initializeSocket(server);
    
    // Register Socket.io handlers
    registerSocketHandlers(io, queues);
    logger.info('Socket.io handlers registered');
    
    // Initialize conversation state cleanup
    logger.info('Initializing conversation state cleanup...');
    initializeCleanup();
    logger.info('Conversation state cleanup initialized');

    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received, starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          // Close Redis connections
          await closeRedisConnections();
          
          // Close all queues
          await closeAllQueues();
          
          // Clean up global references
          delete global.queues;
          
          logger.info('All services shut down gracefully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer(); 