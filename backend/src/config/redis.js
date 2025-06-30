/**
 * Redis configuration and client management
 * Handles Redis connections and provides client instances
 */
import Redis from 'ioredis';
import { config } from './environment.js';
import logger from '../utils/logger.js';

let redisClient = null;
let subscriberClient = null;

/**
 * Create Redis client options
 * @returns {Object} Redis client configuration
 */
const getRedisOptions = () => ({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  keyPrefix: config.redis.keyPrefix,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry attempt ${times}, delay ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      logger.error('Redis READONLY error, reconnecting...');
      return true;
    }
    return false;
  },
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  showFriendlyErrorStack: config.isDevelopment
});

/**
 * Initialize Redis client
 * @returns {Redis} Redis client instance
 */
export const initializeRedis = () => {
  try {
    if (redisClient) {
      return redisClient;
    }

    const options = getRedisOptions();
    redisClient = new Redis(options);

    // Event handlers
    redisClient.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
    });

    redisClient.on('reconnecting', (delay) => {
      logger.info(`Redis client reconnecting in ${delay}ms`);
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis client:', error);
    throw error;
  }
};

/**
 * Get Redis client instance
 * @returns {Redis} Redis client
 */
export const getRedisClient = () => {
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
};

/**
 * Get subscriber client for pub/sub
 * @returns {Redis} Redis subscriber client
 */
export const getSubscriberClient = () => {
  if (!subscriberClient) {
    const options = getRedisOptions();
    subscriberClient = new Redis(options);
    
    subscriberClient.on('ready', () => {
      logger.info('Redis subscriber client ready');
    });
    
    subscriberClient.on('error', (err) => {
      logger.error('Redis subscriber client error:', err);
    });
  }
  return subscriberClient;
};

/**
 * Close Redis connections
 * @returns {Promise<void>}
 */
export const closeRedisConnections = async () => {
  const clients = [redisClient, subscriberClient].filter(Boolean);
  
  await Promise.all(
    clients.map(client => client.quit())
  );
  
  redisClient = null;
  subscriberClient = null;
  
  logger.info('Redis connections closed');
};

/**
 * Check Redis connection health
 * @returns {Promise<boolean>} Is healthy
 */
export const checkRedisHealth = async () => {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
};

/**
 * Get Redis connection status
 * @returns {Object} Redis status information
 */
export const getRedisStatus = () => {
  const client = getRedisClient();
  
  return {
    status: client.status,
    connected: client.status === 'ready',
    options: {
      host: client.options.host,
      port: client.options.port,
      db: client.options.db,
      keyPrefix: client.options.keyPrefix
    }
  };
};

export default {
  initializeRedis,
  getRedisClient,
  getSubscriberClient,
  closeRedisConnections,
  checkRedisHealth,
  getRedisStatus
}; 