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
 * Batch operations for multiple cache keys
 * @param {Array} operations - Array of cache operations
 * @returns {Promise<Array>} Results array
 */
export const batch = async (operations) => {
  try {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    
    operations.forEach(op => {
      switch (op.type) {
        case 'get':
          pipeline.get(op.key);
          break;
        case 'set':
          if (op.ttl > 0) {
            pipeline.setex(op.key, op.ttl, JSON.stringify(op.value));
          } else {
            pipeline.set(op.key, JSON.stringify(op.value));
          }
          break;
        case 'del':
          pipeline.del(op.key);
          break;
        case 'incr':
          pipeline.incrby(op.key, op.amount || 1);
          break;
        case 'decr':
          pipeline.decrby(op.key, op.amount || 1);
          break;
        default:
          logger.warn(`Unknown batch operation type: ${op.type}`);
      }
    });
    
    const results = await pipeline.exec();
    
    // Process results for get operations (parse JSON)
    return results.map((result, index) => {
      const [error, value] = result;
      if (error) {
        logger.error(`Batch operation error at index ${index}:`, error);
        return null;
      }
      
      const op = operations[index];
      if (op.type === 'get' && value) {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          logger.error(`Error parsing batch get result:`, parseError);
          return null;
        }
      }
      
      return value;
    });
  } catch (error) {
    logger.error('Batch cache operation error:', error);
    throw error;
  }
};

/**
 * Multi-get with single Redis call
 * @param {Array} keys - Array of cache keys
 * @returns {Promise<Object>} Object with key-value pairs
 */
export const mget = async (keys) => {
  try {
    const redis = getRedisClient();
    const values = await redis.mget(keys);
    
    const result = {};
    keys.forEach((key, index) => {
      const value = values[index];
      if (value) {
        try {
          result[key] = JSON.parse(value);
        } catch (parseError) {
          logger.error(`Error parsing mget result for key ${key}:`, parseError);
          result[key] = null;
        }
      } else {
        result[key] = null;
      }
    });
    
    return result;
  } catch (error) {
    logger.error('Multi-get cache error:', error);
    throw error;
  }
};

/**
 * Multi-set with single Redis call
 * @param {Object} keyValuePairs - Object with key-value pairs
 * @param {number} [ttl] - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
export const mset = async (keyValuePairs, ttl = config.redis.ttl.default) => {
  try {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    
    Object.entries(keyValuePairs).forEach(([key, value]) => {
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        pipeline.setex(key, ttl, serialized);
      } else {
        pipeline.set(key, serialized);
      }
    });
    
    await pipeline.exec();
    
    logger.debug(`Multi-set cache: ${Object.keys(keyValuePairs).length} keys with TTL ${ttl}s`);
    return true;
  } catch (error) {
    logger.error('Multi-set cache error:', error);
    return false;
  }
};

/**
 * Atomic increment with optional TTL setting
 * @param {string} key - Counter key
 * @param {number} [amount=1] - Increment amount
 * @param {number} [ttl] - Time to live in seconds (only set if key doesn't exist)
 * @returns {Promise<number>} New value
 */
export const incrWithTTL = async (key, amount = 1, ttl = null) => {
  try {
    const redis = getRedisClient();
    
    // Use pipeline for atomic operations
    const pipeline = redis.pipeline();
    pipeline.incrby(key, amount);
    
    // Set TTL only if specified and key is new
    if (ttl) {
      pipeline.expire(key, ttl);
    }
    
    const results = await pipeline.exec();
    const newValue = results[0][1]; // First result is the INCRBY result
    
    return newValue;
  } catch (error) {
    logger.error(`Atomic increment with TTL error for key ${key}:`, error);
    throw error;
  }
};

/**
 * Write-behind pattern utilities (Phase 4)
 */

/**
 * Get or set with write-behind
 * Reads from cache immediately, writes to persistent store asynchronously
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch if not cached
 * @param {Function} writeFn - Function to write to persistent store
 * @param {number} [ttl] - Time to live in seconds
 * @returns {Promise<any>} Cached or fetched data
 */
export const getOrSetWriteBehind = async (key, fetchFn, writeFn, ttl = config.redis.ttl.default) => {
  try {
    // Try to get from cache first
    const cached = await get(key);
    if (cached !== null) {
      logger.debug(`Write-behind cache hit: ${key}`);
      return cached;
    }
    
    // Fetch fresh data
    const data = await fetchFn();
    
    // Cache the data immediately
    await set(key, data, ttl);
    
    // Queue write to persistent store (non-blocking)
    if (writeFn) {
      setImmediate(async () => {
        try {
          await writeFn(data);
        } catch (error) {
          logger.error(`Write-behind persist error for key ${key}:`, error);
        }
      });
    }
    
    return data;
  } catch (error) {
    logger.error(`Write-behind getOrSet error for key ${key}:`, error);
    throw error;
  }
};

/**
 * Update cache with write-behind
 * Updates cache immediately, persists asynchronously
 * @param {string} key - Cache key
 * @param {any} value - New value
 * @param {Function} writeFn - Function to write to persistent store
 * @param {number} [ttl] - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
export const setWriteBehind = async (key, value, writeFn, ttl = config.redis.ttl.default) => {
  try {
    // Update cache immediately
    const success = await set(key, value, ttl);
    
    // Queue write to persistent store (non-blocking)
    if (success && writeFn) {
      setImmediate(async () => {
        try {
          await writeFn(value);
        } catch (error) {
          logger.error(`Write-behind persist error for key ${key}:`, error);
        }
      });
    }
    
    return success;
  } catch (error) {
    logger.error(`Write-behind set error for key ${key}:`, error);
    return false;
  }
};

/**
 * Batch write-behind operations
 * @param {Array} operations - Array of write operations
 * @returns {Promise<Object>} Results
 */
export const batchWriteBehind = async (operations) => {
  const results = {
    cached: 0,
    queued: 0,
    failed: 0
  };
  
  try {
    // First, update all caches
    const cacheOps = operations.map(op => ({
      type: 'set',
      key: op.key,
      value: op.value,
      ttl: op.ttl || config.redis.ttl.default
    }));
    
    const cacheResults = await batch(cacheOps);
    results.cached = cacheResults.filter(r => r !== null).length;
    
    // Queue persistent writes (non-blocking)
    setImmediate(async () => {
      for (const op of operations) {
        if (op.writeFn) {
          try {
            await op.writeFn(op.value);
            results.queued++;
          } catch (error) {
            logger.error(`Batch write-behind error for key ${op.key}:`, error);
            results.failed++;
          }
        }
      }
    });
    
    return results;
  } catch (error) {
    logger.error('Batch write-behind error:', error);
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
  rateLimit: (identifier, endpoint) => `ratelimit:${identifier}:${endpoint}`,
  // Batch operation keys
  messageBatch: () => 'batch:messages',
  statsBatch: (characterId) => `batch:stats:${characterId}`,
  conversationBuffer: (conversationId) => `buffer:conversation:${conversationId}`
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
  batch,
  mget,
  mset,
  incrWithTTL,
  getOrSetWriteBehind,
  setWriteBehind,
  batchWriteBehind,
  keys
}; 