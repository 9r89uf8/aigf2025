/**
 * Cache service
 * Manages caching operations with Redis
 */
import { getRedisClient } from '../config/redis.js';
import { config } from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * Get cached data
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached data or null
 */
export const get = async (key) => {
  try {
    const redis = getRedisClient();
    const data = await redis.get(key);
    
    if (data) {
      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(data);
    }
    
    logger.debug(`Cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.error(`Cache get error for key ${key}:`, error);
    return null;
  }
};

/**
 * Set cache data
 * @param {string} key - Cache key
 * @param {any} value - Data to cache
 * @param {number} [ttl] - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
export const set = async (key, value, ttl = config.redis.ttl.default) => {
  try {
    const redis = getRedisClient();
    const serialized = JSON.stringify(value);
    
    if (ttl > 0) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
    
    logger.debug(`Cache set: ${key} with TTL ${ttl}s`);
    return true;
  } catch (error) {
    logger.error(`Cache set error for key ${key}:`, error);
    return false;
  }
};

/**
 * Delete cached data
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
export const del = async (key) => {
  try {
    const redis = getRedisClient();
    const result = await redis.del(key);
    
    logger.debug(`Cache delete: ${key}, result: ${result}`);
    return result > 0;
  } catch (error) {
    logger.error(`Cache delete error for key ${key}:`, error);
    return false;
  }
};

/**
 * Delete multiple cache keys by pattern
 * @param {string} pattern - Key pattern (e.g., 'user:*')
 * @returns {Promise<number>} Number of keys deleted
 */
export const delByPattern = async (pattern) => {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    const pipeline = redis.pipeline();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();
    
    logger.debug(`Cache delete by pattern: ${pattern}, deleted ${keys.length} keys`);
    return keys.length;
  } catch (error) {
    logger.error(`Cache delete by pattern error for ${pattern}:`, error);
    return 0;
  }
};

/**
 * Check if key exists
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Exists status
 */
export const exists = async (key) => {
  try {
    const redis = getRedisClient();
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.error(`Cache exists error for key ${key}:`, error);
    return false;
  }
};

/**
 * Set cache expiration
 * @param {string} key - Cache key
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
export const expire = async (key, ttl) => {
  try {
    const redis = getRedisClient();
    const result = await redis.expire(key, ttl);
    return result === 1;
  } catch (error) {
    logger.error(`Cache expire error for key ${key}:`, error);
    return false;
  }
};

/**
 * Get or set cache data
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} [ttl] - Time to live in seconds
 * @returns {Promise<any>} Cached or fetched data
 */
export const getOrSet = async (key, fetchFn, ttl = config.redis.ttl.cache) => {
  try {
    // Try to get from cache
    const cached = await get(key);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch fresh data
    const data = await fetchFn();
    
    // Cache the data
    await set(key, data, ttl);
    
    return data;
  } catch (error) {
    logger.error(`Cache getOrSet error for key ${key}:`, error);
    throw error;
  }
};

/**
 * Increment counter
 * @param {string} key - Counter key
 * @param {number} [amount=1] - Increment amount
 * @returns {Promise<number>} New value
 */
export const incr = async (key, amount = 1) => {
  try {
    const redis = getRedisClient();
    const result = await redis.incrby(key, amount);
    return result;
  } catch (error) {
    logger.error(`Cache increment error for key ${key}:`, error);
    throw error;
  }
};

/**
 * Decrement counter
 * @param {string} key - Counter key
 * @param {number} [amount=1] - Decrement amount
 * @returns {Promise<number>} New value
 */
export const decr = async (key, amount = 1) => {
  try {
    const redis = getRedisClient();
    const result = await redis.decrby(key, amount);
    return result;
  } catch (error) {
    logger.error(`Cache decrement error for key ${key}:`, error);
    throw error;
  }
};

/**
 * Cache key builders
 */
export const keys = {
  user: (uid) => `user:${uid}`,
  userProfile: (uid) => `user:profile:${uid}`,
  userByUsername: (username) => `user:username:${username}`,
  usernameExists: (username) => `username:exists:${username}`,
  userUsage: (uid, characterId) => `user:usage:${uid}:${characterId}`,
  character: (id) => `character:${id}`,
  characterList: () => 'characters:list',
  characterGallery: (characterId) => `character:gallery:${characterId}`,
  characterStats: (characterId) => `character:stats:${characterId}`,
  conversation: (userId, characterId) => `conversation:${userId}:${characterId}`,
  conversationMeta: (conversationId) => `conversation:meta:${conversationId}`,
  userConversations: (userId) => `user:conversations:${userId}`,
  conversationContext: (conversationId) => `conversation:context:${conversationId}`,
  personalityResult: (characterId, responseHash) => `personality:${characterId}:${responseHash}`,
  characterPrompt: (characterId) => `character:prompt:${characterId}`,
  session: (sessionId) => `session:${sessionId}`,
  rateLimit: (identifier, endpoint) => `ratelimit:${identifier}:${endpoint}`
};

export default {
  get,
  set,
  del,
  delByPattern,
  exists,
  expire,
  getOrSet,
  incr,
  decr,
  keys
}; 