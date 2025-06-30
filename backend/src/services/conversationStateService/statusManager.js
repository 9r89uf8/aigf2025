/**
 * Status Manager Module
 * Handles queue status reporting and monitoring
 */
import { getRedisClient } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { REDIS_KEYS } from './constants.js';
import { getConversationState } from './stateManager.js';

/**
 * Get queue status for WebSocket updates
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Queue status information
 */
export const getQueueStatus = async (conversationId) => {
  try {
    const state = await getConversationState(conversationId);
    
    const status = {
      conversationId,
      state: state.state,
      queueLength: state.messageQueue.length,
      currentlyProcessing: state.currentlyProcessing,
      processingStartedAt: state.processingStartedAt,
      lastProcessedAt: state.lastProcessedAt,
      queuedMessages: state.messageQueue.map(msg => ({
        messageId: msg.messageId,
        queuedAt: msg.queuedAt,
        tempId: msg.tempId
      }))
    };
    
    // Add processing duration if applicable
    if (state.processingStartedAt) {
      status.processingDuration = Date.now() - new Date(state.processingStartedAt).getTime();
    }
    
    return status;
  } catch (error) {
    logger.error('Error getting queue status:', error);
    throw error;
  }
};

/**
 * Get all conversation states for monitoring/debugging
 * @returns {Promise<Object[]>} Array of all conversation states
 */
export const getAllConversationStates = async () => {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(REDIS_KEYS.CONVERSATION_STATE_PATTERN);
    
    const states = [];
    const errors = [];
    
    for (const key of keys) {
      try {
        const stateData = await redis.get(key);
        if (stateData) {
          const state = JSON.parse(stateData);
          states.push(formatStateForMonitoring(state));
        }
      } catch (error) {
        errors.push({ key, error: error.message });
        logger.error('Error parsing conversation state:', { key, error: error.message });
      }
    }
    
    if (errors.length > 0) {
      logger.warn('Some conversation states could not be retrieved', { errorCount: errors.length });
    }
    
    return states;
  } catch (error) {
    logger.error('Error getting all conversation states:', error);
    return [];
  }
};

/**
 * Get conversation statistics
 * @returns {Promise<Object>} Aggregate statistics
 */
export const getConversationStats = async () => {
  try {
    const states = await getAllConversationStates();
    
    const stats = {
      totalConversations: states.length,
      byState: {
        idle: 0,
        processing: 0,
        queued: 0
      },
      totalQueuedMessages: 0,
      averageQueueLength: 0,
      longestQueue: 0,
      stuckProcessing: 0
    };
    
    // Calculate statistics
    states.forEach(state => {
      stats.byState[state.state]++;
      stats.totalQueuedMessages += state.queueLength;
      stats.longestQueue = Math.max(stats.longestQueue, state.queueLength);
      
      if (state.isStuck) {
        stats.stuckProcessing++;
      }
    });
    
    // Calculate average queue length
    if (states.length > 0) {
      stats.averageQueueLength = stats.totalQueuedMessages / states.length;
    }
    
    return stats;
  } catch (error) {
    logger.error('Error calculating conversation stats:', error);
    throw error;
  }
};

/**
 * Format state for monitoring output
 * @param {Object} state - Raw conversation state
 * @returns {Object} Formatted state for monitoring
 */
const formatStateForMonitoring = (state) => {
  const formatted = {
    conversationId: state.conversationId,
    state: state.state,
    queueLength: state.messageQueue.length,
    currentlyProcessing: state.currentlyProcessing,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    lastProcessedAt: state.lastProcessedAt
  };
  
  // Add processing info if applicable
  if (state.processingStartedAt) {
    const processingDuration = Date.now() - new Date(state.processingStartedAt).getTime();
    formatted.processingDuration = Math.floor(processingDuration / 1000) + 's';
    formatted.isStuck = processingDuration > 120000; // 2 minutes
  }
  
  // Add queue age info
  if (state.messageQueue.length > 0) {
    const oldestMessage = state.messageQueue[0];
    const queueAge = Date.now() - new Date(oldestMessage.queuedAt).getTime();
    formatted.oldestMessageAge = Math.floor(queueAge / 1000) + 's';
  }
  
  return formatted;
};

export default {
  getQueueStatus,
  getAllConversationStates,
  getConversationStats
};