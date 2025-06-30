/**
 * Redis Rate Limiter Middleware
 * Provides high-performance rate limiting using Redis
 */
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

let redisClient;

/**
 * Initialize Redis client for rate limiting
 */
const initializeRedisClient = () => {
  if (!redisClient) {
    redisClient = getRedisClient();
  }
  return redisClient;
};

// Initialize client
initializeRedisClient();

/**
 * Create rate limiter middleware
 * @param {RateLimiterRedis} rateLimiter - Rate limiter instance
 * @returns {Function} Express middleware
 */
const createMiddleware = (rateLimiter) => {
  return async (req, res, next) => {
    try {
      // Use user ID if authenticated, otherwise use IP
      const key = req.user?.uid || req.ip;
      
      await rateLimiter.consume(key);
      
      next();
    } catch (rejRes) {
      // Rate limit exceeded
      res.set({
        'Retry-After': Math.round(rejRes.msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': rateLimiter.points,
        'X-RateLimit-Remaining': rejRes.remainingPoints || 0,
        'X-RateLimit-Reset': new Date(Date.now() + rejRes.msBeforeNext).toISOString()
      });
      
      logger.warn('Rate limit exceeded', {
        key: req.user?.uid || req.ip,
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
        retryAfter: Math.round(rejRes.msBeforeNext / 1000)
      });
    }
  };
};

/**
 * API rate limiter - general API endpoints
 */
export const apiLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'api',
  points: 100, // requests
  duration: 900, // per 15 minutes
  blockDuration: 0 // no blocking
});

/**
 * Auth rate limiter - login/register endpoints
 */
export const authLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'auth',
  points: 5, // requests
  duration: 900, // per 15 minutes
  blockDuration: 900 // block for 15 minutes
});

/**
 * Strict rate limiter - sensitive operations
 */
export const strictLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'strict',
  points: 3, // requests
  duration: 3600, // per hour
  blockDuration: 3600 // block for 1 hour
});

/**
 * Message rate limiter - sending messages
 */
export const messageLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'message',
  points: 10, // messages
  duration: 60, // per minute
  blockDuration: 60 // block for 1 minute
});

/**
 * AI rate limiter - AI-powered features
 */
export const aiLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ai',
  points: 20, // requests
  duration: 300, // per 5 minutes
  blockDuration: 300 // block for 5 minutes
});

/**
 * Upload rate limiter - file uploads
 */
export const uploadLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'upload',
  points: 20, // uploads
  duration: 3600, // per hour
  blockDuration: 300 // block for 5 minutes
});

/**
 * Premium user rate limiter - more generous limits
 */
export const premiumApiLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'premium:api',
  points: 1000, // requests
  duration: 900, // per 15 minutes
  blockDuration: 0 // no blocking
});

/**
 * Premium message rate limiter
 */
export const premiumMessageLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'premium:message',
  points: 100, // messages
  duration: 60, // per minute
  blockDuration: 0 // no blocking
});

/**
 * Middleware that selects appropriate rate limiter based on user type
 * @param {Object} limiters - Object with standard and premium rate limiters
 * @returns {Function} Express middleware
 */
export const createDynamicRateLimiter = ({ standard, premium }) => {
  return async (req, res, next) => {
    const limiter = req.user?.isPremium ? premium : standard;
    const middleware = createMiddleware(limiter);
    return middleware(req, res, next);
  };
};

/**
 * Export all limiters with middleware
 */
export const redisRateLimiter = {
  api: createDynamicRateLimiter({
    standard: apiLimiter,
    premium: premiumApiLimiter
  }),
  auth: createMiddleware(authLimiter),
  strict: createMiddleware(strictLimiter),
  message: createDynamicRateLimiter({
    standard: messageLimiter,
    premium: premiumMessageLimiter
  }),
  messages: createDynamicRateLimiter({
    standard: messageLimiter,
    premium: premiumMessageLimiter
  }),
  ai: createMiddleware(aiLimiter),
  uploads: createMiddleware(uploadLimiter)
};

export default redisRateLimiter; 