/**
 * Usage tracking service
 * Manages message usage tracking with Redis for real-time updates
 */
import { getRedisClient } from '../config/redis.js';
import cache from './cacheService.js';
import { config } from '../config/environment.js';
import { ApiError } from '../middleware/errorHandler.js';
import { emitToUser, SOCKET_EVENTS } from '../config/socket.js';
import logger from '../utils/logger.js';

/**
 * Get user message usage for a character
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @returns {Promise<Object>} Usage data
 */
export const getUserUsage = async (userId, characterId) => {
  try {
    const key = cache.keys.userUsage(userId, characterId);
    const usage = await cache.get(key);
    
    if (usage) {
      return usage;
    }
    
    // Initialize default usage
    const defaultUsage = {
      textMessages: 0,
      audioMessages: 0,
      mediaMessages: 0,
      firstMessageAt: null,
      lastMessageAt: null,
      resetAt: new Date().toISOString()
    };
    
    await cache.set(key, defaultUsage, config.redis.ttl.usage);
    return defaultUsage;
  } catch (error) {
    logger.error('Error getting user usage:', error);
    throw error;
  }
};

/**
 * Check if user can send message
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @param {string} messageType - Message type (text, audio, media)
 * @param {boolean} isPremium - User premium status
 * @returns {Promise<Object>} Can send result
 */
export const canSendMessage = async (userId, characterId, messageType, isPremium) => {
  try {
    // Premium users have unlimited messages
    if (isPremium) {
      return { 
        canSend: true, 
        reason: 'premium',
        usage: null
      };
    }
    
    // Get current usage
    const usage = await getUserUsage(userId, characterId);
    
    // Define limits for free tier
    const limits = {
      text: 30,
      audio: 5,
      media: 5
    };
    
    const messageCount = usage[`${messageType}Messages`] || 0;
    const limit = limits[messageType] || 0;
    
    if (messageCount >= limit) {
      // Emit usage limit reached event
      try {
        const formattedUsage = {
          text: { used: usage.textMessages || 0, limit: 30 },
          image: { used: usage.mediaMessages || 0, limit: 5 },
          audio: { used: usage.audioMessages || 0, limit: 5 }
        };
        
        emitToUser(userId, SOCKET_EVENTS.USAGE_LIMIT, {
          characterId,
          messageType,
          limit,
          used: messageCount,
          remaining: 0,
          resetAt: usage.resetAt,
          usage: formattedUsage
        });
        
        logger.debug('Usage limit reached event emitted', { userId, characterId, messageType, limit });
      } catch (emitError) {
        logger.error('Failed to emit usage limit event (non-blocking):', emitError);
      }
      
      return { 
        canSend: false, 
        reason: 'limit_reached',
        limit,
        used: messageCount,
        remaining: 0,
        resetAt: usage.resetAt
      };
    }
    
    return { 
      canSend: true, 
      reason: 'within_limit',
      limit,
      used: messageCount,
      remaining: limit - messageCount
    };
  } catch (error) {
    logger.error('Error checking message permission:', error);
    throw error;
  }
};

/**
 * Increment message usage
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @param {string} messageType - Message type (text, audio, media)
 * @returns {Promise<Object>} Updated usage
 */
export const incrementUsage = async (userId, characterId, messageType) => {
  try {
    const redis = getRedisClient();
    const key = cache.keys.userUsage(userId, characterId);
    
    // Get current usage
    let usage = await getUserUsage(userId, characterId);
    
    // Update usage
    const messageKey = `${messageType}Messages`;
    usage[messageKey] = (usage[messageKey] || 0) + 1;
    usage.lastMessageAt = new Date().toISOString();
    
    if (!usage.firstMessageAt) {
      usage.firstMessageAt = new Date().toISOString();
    }
    
    // Save updated usage
    await cache.set(key, usage, config.redis.ttl.usage);
    
    // Also increment in sorted set for analytics
    const analyticsKey = `analytics:messages:${new Date().toISOString().split('T')[0]}`;
    await redis.zincrby(analyticsKey, 1, `${userId}:${characterId}:${messageType}`);
    await redis.expire(analyticsKey, 86400 * 30); // Keep for 30 days
    
    logger.debug('Usage incremented', { userId, characterId, messageType, newCount: usage[messageKey] });
    
    // Emit usage update via WebSocket for real-time UI updates
    try {
      // Format usage data to match frontend expectations
      const formattedUsage = {
        text: { used: usage.textMessages || 0, limit: 30 },
        image: { used: usage.mediaMessages || 0, limit: 5 },
        audio: { used: usage.audioMessages || 0, limit: 5 }
      };
      
      logger.info('🔍 USAGE DEBUG: Emitting usage update', {
        userId,
        characterId,
        formattedUsage,
        event: SOCKET_EVENTS.USAGE_UPDATE,
        timestamp: new Date().toISOString()
      });

      emitToUser(userId, SOCKET_EVENTS.USAGE_UPDATE, {
        characterId,
        usage: formattedUsage
      });
      
      // Add room status diagnostics
      const { getSocketIO } = await import('../config/socket.js');
      const io = getSocketIO();
      const userRoom = `user:${userId}`;
      const roomSize = io.sockets.adapter.rooms.get(userRoom)?.size || 0;
      logger.info('🔍 USAGE DEBUG: User room status', {
        userId,
        userRoom,
        roomSize,
        hasActiveConnections: roomSize > 0
      });
      
      logger.debug('Usage update emitted via WebSocket', { userId, characterId, formattedUsage });
    } catch (emitError) {
      logger.error('Failed to emit usage update (non-blocking):', emitError);
      // Don't fail the increment operation if WebSocket emit fails
    }
    
    return usage;
  } catch (error) {
    logger.error('Error incrementing usage:', error);
    throw error;
  }
};

/**
 * Reset user usage for a character
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @returns {Promise<void>}
 */
export const resetUsage = async (userId, characterId) => {
  try {
    const key = cache.keys.userUsage(userId, characterId);
    
    const resetUsage = {
      textMessages: 0,
      audioMessages: 0,
      mediaMessages: 0,
      firstMessageAt: null,
      lastMessageAt: null,
      resetAt: new Date().toISOString()
    };
    
    await cache.set(key, resetUsage, config.redis.ttl.usage);
    
    logger.info('Usage reset', { userId, characterId });
    
    // Emit usage update via WebSocket for real-time UI updates
    try {
      const formattedUsage = {
        text: { used: 0, limit: 30 },
        image: { used: 0, limit: 5 },
        audio: { used: 0, limit: 5 }
      };
      
      emitToUser(userId, SOCKET_EVENTS.USAGE_UPDATE, {
        characterId,
        usage: formattedUsage
      });
      
      logger.debug('Usage reset emitted via WebSocket', { userId, characterId });
    } catch (emitError) {
      logger.error('Failed to emit usage reset (non-blocking):', emitError);
    }
  } catch (error) {
    logger.error('Error resetting usage:', error);
    throw error;
  }
};

/**
 * Get all character usage for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} All character usage
 */
export const getAllUserUsage = async (userId) => {
  try {
    const redis = getRedisClient();
    const pattern = `${config.redis.keyPrefix}user:usage:${userId}:*`;
    const keys = await redis.keys(pattern);
    
    logger.debug('Getting all user usage', { 
      userId, 
      pattern, 
      keysFound: keys.length,
      keys: keys
    });
    
    const usage = {};
    
    for (const key of keys) {
      // Extract character ID from key (remove prefix first)
      const keyWithoutPrefix = key.replace(config.redis.keyPrefix, '');
      const parts = keyWithoutPrefix.split(':');
      const characterId = parts[parts.length - 1];
      
      logger.debug('Processing usage key', { 
        key, 
        keyWithoutPrefix, 
        parts, 
        characterId 
      });
      
      // Use cache.get() instead of direct redis.get() to handle prefixes properly
      const cacheKey = cache.keys.userUsage(userId, characterId);
      const data = await cache.get(cacheKey);
      
      if (data) {
        usage[characterId] = data; // data is already parsed by cache.get()
        logger.debug('Added character usage', { 
          characterId, 
          usage: usage[characterId] 
        });
      }
    }

    logger.debug('Final usage result', { 
      userId, 
      characterCount: Object.keys(usage).length,
      usage 
    });

    return usage;
  } catch (error) {
    logger.error('Error getting all user usage:', error);
    throw error;
  }
};

/**
 * Track message in real-time
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @param {string} messageType - Message type
 * @param {Object} messageData - Additional message data
 * @returns {Promise<void>}
 */
export const trackMessage = async (userId, characterId, messageType, messageData = {}) => {
  try {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    
    // Track in real-time stats
    const hourKey = `stats:messages:hour:${new Date().toISOString().substring(0, 13)}`;
    const dayKey = `stats:messages:day:${new Date().toISOString().substring(0, 10)}`;
    
    pipeline.hincrby(hourKey, `${messageType}:total`, 1);
    pipeline.hincrby(hourKey, `${messageType}:${characterId}`, 1);
    pipeline.expire(hourKey, 3600 * 25); // Keep for 25 hours
    
    pipeline.hincrby(dayKey, `${messageType}:total`, 1);
    pipeline.hincrby(dayKey, `${messageType}:${characterId}`, 1);
    pipeline.expire(dayKey, 86400 * 31); // Keep for 31 days
    
    // Track user activity
    const activityKey = `activity:users:${new Date().toISOString().substring(0, 10)}`;
    pipeline.sadd(activityKey, userId);
    pipeline.expire(activityKey, 86400 * 31);
    
    await pipeline.exec();
    
    logger.debug('Message tracked', { userId, characterId, messageType });
  } catch (error) {
    logger.error('Error tracking message:', error);
    // Don't throw - tracking failures shouldn't break the flow
  }
};

/**
 * Get usage statistics
 * @param {string} period - Period (hour, day, week, month)
 * @returns {Promise<Object>} Statistics
 */
export const getUsageStats = async (period = 'day') => {
  try {
    const redis = getRedisClient();
    const now = new Date();
    let stats = {};
    
    switch (period) {
      case 'hour':
        const hourKey = `stats:messages:hour:${now.toISOString().substring(0, 13)}`;
        stats = await redis.hgetall(hourKey);
        break;
        
      case 'day':
        const dayKey = `stats:messages:day:${now.toISOString().substring(0, 10)}`;
        stats = await redis.hgetall(dayKey);
        break;
        
      case 'week':
        // Aggregate last 7 days
        stats = { text: { total: 0 }, audio: { total: 0 }, media: { total: 0 } };
        for (let i = 0; i < 7; i++) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const key = `stats:messages:day:${date.toISOString().substring(0, 10)}`;
          const dayStats = await redis.hgetall(key);
          
          Object.entries(dayStats).forEach(([k, v]) => {
            const [type, subkey] = k.split(':');
            if (!stats[type]) stats[type] = {};
            stats[type][subkey] = (stats[type][subkey] || 0) + parseInt(v);
          });
        }
        break;
    }
    
    return stats;
  } catch (error) {
    logger.error('Error getting usage stats:', error);
    throw error;
  }
};

export default {
  getUserUsage,
  canSendMessage,
  incrementUsage,
  resetUsage,
  getAllUserUsage,
  trackMessage,
  getUsageStats
}; 