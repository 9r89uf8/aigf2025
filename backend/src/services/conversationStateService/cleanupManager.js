/**
 * Cleanup Manager Module
 * Handles expired message cleanup and maintenance tasks
 */
import { getRedisClient } from '../../config/redis.js';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger.js';
import { CONVERSATION_STATES, QUEUE_CONFIG, REDIS_KEYS } from './constants.js';

let cleanupInterval = null;

/**
 * Clean up expired messages from all conversation queues
 * @returns {Promise<Object>} Cleanup statistics
 */
export const cleanupExpiredMessages = async () => {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(REDIS_KEYS.CONVERSATION_STATE_PATTERN);
    
    let cleanedCount = 0;
    let conversationsProcessed = 0;
    const errors = [];
    
    for (const key of keys) {
      try {
        const cleanupResult = await cleanupConversationQueue(redis, key);
        if (cleanupResult.cleaned > 0) {
          cleanedCount += cleanupResult.cleaned;
        }
        conversationsProcessed++;
      } catch (error) {
        errors.push({ key, error: error.message });
        logger.error('Error cleaning conversation state:', { key, error: error.message });
      }
    }
    
    if (cleanedCount > 0) {
      logger.info('Cleaned up expired messages', { 
        cleanedCount, 
        conversationsProcessed,
        totalConversations: keys.length 
      });
    }
    
    return {
      cleanedCount,
      conversationsProcessed,
      totalConversations: keys.length,
      errors
    };
  } catch (error) {
    logger.error('Error during cleanup:', error);
    throw error;
  }
};

/**
 * Clean up a single conversation's queue
 * @param {Object} redis - Redis client
 * @param {string} key - Redis key for conversation state
 * @returns {Promise<Object>} Cleanup result
 */
const cleanupConversationQueue = async (redis, key) => {
  const stateData = await redis.get(key);
  if (!stateData) {
    return { cleaned: 0 };
  }
  
  const state = JSON.parse(stateData);
  const originalLength = state.messageQueue.length;
  
  // Remove expired messages
  const now = Date.now();
  state.messageQueue = state.messageQueue.filter(msg => {
    const messageAge = now - new Date(msg.queuedAt).getTime();
    const isExpired = messageAge > QUEUE_CONFIG.MESSAGE_TTL * 1000;
    
    if (isExpired) {
      logger.debug('Removing expired message', {
        conversationId: state.conversationId,
        messageId: msg.messageId,
        ageSeconds: Math.floor(messageAge / 1000)
      });
    }
    
    return !isExpired;
  });
  
  // Update state if messages were removed
  const cleanedCount = originalLength - state.messageQueue.length;
  
  if (cleanedCount > 0) {
    // Update conversation state based on remaining messages
    if (state.messageQueue.length === 0 && state.state !== CONVERSATION_STATES.PROCESSING) {
      state.state = CONVERSATION_STATES.IDLE;
    }
    
    state.updatedAt = new Date().toISOString();
    await redis.setex(key, config.redis.ttl.cache || 3600, JSON.stringify(state));
  }
  
  return { cleaned: cleanedCount };
};

/**
 * Initialize automatic cleanup interval
 * @returns {void}
 */
export const initializeCleanup = () => {
  if (cleanupInterval) {
    logger.warn('Cleanup interval already initialized');
    return;
  }
  
  cleanupInterval = setInterval(async () => {
    try {
      await cleanupExpiredMessages();
    } catch (error) {
      logger.error('Cleanup interval error:', error);
    }
  }, QUEUE_CONFIG.CLEANUP_INTERVAL * 1000);
  
  logger.info('Conversation state cleanup initialized', {
    interval: QUEUE_CONFIG.CLEANUP_INTERVAL,
    messageTTL: QUEUE_CONFIG.MESSAGE_TTL
  });
};

/**
 * Stop cleanup interval
 * @returns {void}
 */
export const stopCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Conversation state cleanup stopped');
  }
};

/**
 * Manually trigger cleanup for a specific conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Cleanup result
 */
export const cleanupConversation = async (conversationId) => {
  try {
    const redis = getRedisClient();
    const key = `${REDIS_KEYS.CONVERSATION_STATE}${conversationId}`;
    
    const result = await cleanupConversationQueue(redis, key);
    
    logger.debug('Manual cleanup completed', {
      conversationId,
      messagesRemoved: result.cleaned
    });
    
    return result;
  } catch (error) {
    logger.error('Error in manual cleanup:', error);
    throw error;
  }
};

export default {
  cleanupExpiredMessages,
  initializeCleanup,
  stopCleanup,
  cleanupConversation
};