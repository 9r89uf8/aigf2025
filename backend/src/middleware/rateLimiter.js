/**
 * Rate limiter middleware using Redis
 * Provides flexible rate limiting with different strategies
 */
import { getRedisClient } from '../config/redis.js';
import { ApiError } from './errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} [options.keyPrefix] - Redis key prefix
 * @param {Function} [options.keyGenerator] - Custom key generator function
 * @param {Function} [options.skip] - Function to skip rate limiting
 * @param {string} [options.message] - Error message
 * @returns {Function} Express middleware
 */
export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    keyPrefix = 'ratelimit',
    keyGenerator = (req) => req.ip,
    skip = () => false,
    message = 'Too many requests, please try again later.'
  } = options;

  return async (req, res, next) => {
    try {
      // Check if should skip
      if (skip(req)) {
        return next();
      }

      const redis = getRedisClient();
      const identifier = keyGenerator(req);
      const key = `${keyPrefix}:${identifier}:${req.path}`;
      
      // Get current count
      const current = await redis.incr(key);
      
      // Set expiration on first request
      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }
      
      // Get TTL for headers
      const ttl = await redis.pttl(key);
      const resetTime = new Date(Date.now() + ttl).toISOString();
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
      res.setHeader('X-RateLimit-Reset', resetTime);
      
      // Check if limit exceeded
      if (current > max) {
        logger.warn('Rate limit exceeded', { 
          identifier, 
          path: req.path, 
          current, 
          max 
        });
        
        res.setHeader('Retry-After', Math.ceil(ttl / 1000));
        throw new ApiError(429, message);
      }
      
      next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Log error but don't block request on Redis failure
      logger.error('Rate limiter error:', error);
      next();
    }
  };
};

/**
 * Create sliding window rate limiter
 * More accurate but uses more Redis operations
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express middleware
 */
export const createSlidingWindowRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    keyPrefix = 'ratelimit:sliding',
    keyGenerator = (req) => req.ip,
    skip = () => false,
    message = 'Too many requests, please try again later.'
  } = options;

  return async (req, res, next) => {
    try {
      if (skip(req)) {
        return next();
      }

      const redis = getRedisClient();
      const identifier = keyGenerator(req);
      const key = `${keyPrefix}:${identifier}:${req.path}`;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Use Redis sorted set for sliding window
      const pipeline = redis.pipeline();
      
      // Remove old entries
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      
      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      
      // Count requests in window
      pipeline.zcount(key, windowStart, '+inf');
      
      // Set expiration
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results[2][1];
      
      // Set headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
      
      if (count > max) {
        logger.warn('Sliding window rate limit exceeded', { 
          identifier, 
          path: req.path, 
          count, 
          max 
        });
        
        throw new ApiError(429, message);
      }
      
      next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      logger.error('Sliding window rate limiter error:', error);
      next();
    }
  };
};

/**
 * Predefined rate limiters
 */
export const rateLimiters = {
  // Strict rate limit for auth endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyPrefix: 'ratelimit:auth',
    message: 'Too many authentication attempts, please try again later.'
  }),
  
  // API rate limit
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    keyPrefix: 'ratelimit:api',
    skip: (req) => req.user?.isPremium // Skip for premium users
  }),
  
  // Message sending rate limit
  message: createSlidingWindowRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    keyPrefix: 'ratelimit:message',
    keyGenerator: (req) => req.user?.uid || req.ip,
    skip: (req) => req.user?.isPremium
  }),
  
  // File upload rate limit
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    keyPrefix: 'ratelimit:upload',
    keyGenerator: (req) => req.user?.uid || req.ip
  })
};

export default {
  createRateLimiter,
  createSlidingWindowRateLimiter,
  rateLimiters
}; 