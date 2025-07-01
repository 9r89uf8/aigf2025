/**
 * Environment configuration module
 * Centralizes environment variable access with validation
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

/**
 * Validates required environment variables
 * @throws {Error} If required variables are missing
 */
const validateEnvironment = () => {
  const required = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Validate on module load
validateEnvironment();

/**
 * Environment configuration object
 */
export const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // Firebase configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    authUri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    tokenUri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    authProviderCertUrl: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    clientCertUrl: process.env.FIREBASE_CLIENT_CERT_URL
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'aim:',
    ttl: {
      default: 3600, // 1 hour
      session: 86400, // 24 hours
      cache: 300, // 5 minutes (for general short-term caching)
      userProfile: 3600, // 1 hour (user profiles change occasionally)
      character: 21600, // 6 hours (character data changes rarely)
      conversation: 1800, // 30 minutes (conversations change frequently)
      usage: 86400, // 24 hours (daily usage tracking reset)
      // Batch operation TTLs
      messageBatch: 600, // 10 minutes (message batch buffer)
      statsBatch: 3600, // 1 hour (stats batch buffer)
      conversationBuffer: 900, // 15 minutes (conversation buffer)
      conversationContext: 900 // 15 minutes (conversation context cache)
    },
    // Batch operation settings
    batch: {
      flushInterval: parseInt(process.env.REDIS_BATCH_FLUSH_INTERVAL || '60000'), // 60 seconds
      maxBufferSize: parseInt(process.env.REDIS_BATCH_MAX_SIZE || '400'), // Max operations before force flush
      lockTimeout: parseInt(process.env.REDIS_BATCH_LOCK_TIMEOUT || '10000'), // 10 seconds
      retryAttempts: parseInt(process.env.REDIS_BATCH_RETRY_ATTEMPTS || '3'),
      enableBatching: process.env.REDIS_ENABLE_BATCHING !== 'false' // Enable by default
    }
  },
  
  // DeepSeek configuration
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  },
  
  // Google Cloud configuration (for TTS)
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
  },
  
  // Stripe configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },
  
  // Storage configuration
  storage: {
    bucket: process.env.STORAGE_BUCKET,
    cdnBaseUrl: process.env.CDN_BASE_URL
  },
  
  // AI Context configuration
  ai: {
    // Maximum number of messages to include in conversation context for AI
    maxContextMessages: parseInt(process.env.AI_MAX_CONTEXT_MESSAGES || '50'), // Increased from 20 to 50 for debugging
    // Minimum number of messages to ensure context has substance
    minContextMessages: parseInt(process.env.AI_MIN_CONTEXT_MESSAGES || '2'),
    // Enable debug logging for AI context
    debugContext: process.env.AI_DEBUG_CONTEXT === 'true' || process.env.NODE_ENV === 'development'
  }
};

export default config; 