/**
 * State Manager Module
 * Handles core conversation state operations (get/set)
 */
import { getRedisClient } from '../../config/redis.js';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger.js';
import { CONVERSATION_STATES, QUEUE_CONFIG, REDIS_KEYS } from './constants.js';

/**
 * Get conversation state from Redis
 * @param {string} conversationId - Conversation ID (userId_characterId)
 * @returns {Promise<Object>} Conversation state object
 */
export const getConversationState = async (conversationId) => {
  try {
    const redis = getRedisClient();
    const stateKey = `${REDIS_KEYS.CONVERSATION_STATE}${conversationId}`;
    
    const stateData = await redis.get(stateKey);
    
    if (!stateData) {
      // Initialize new conversation state
      const newState = createInitialState(conversationId);
      await setConversationState(conversationId, newState);
      return newState;
    }
    
    const state = JSON.parse(stateData);
    
    // Check for stuck processing state
    if (isProcessingStuck(state)) {
      logger.warn('Conversation stuck in processing state, resetting', {
        conversationId,
        processingDuration: getProcessingDuration(state)
      });
      // Return state as-is, let processingManager handle reset
      state.needsReset = true;
    }
    
    return state;
  } catch (error) {
    logger.error('Error getting conversation state:', error);
    throw error;
  }
};

/**
 * Set conversation state in Redis
 * @param {string} conversationId - Conversation ID
 * @param {Object} state - Conversation state object
 * @returns {Promise<void>}
 */
export const setConversationState = async (conversationId, state) => {
  try {
    const redis = getRedisClient();
    const stateKey = `${REDIS_KEYS.CONVERSATION_STATE}${conversationId}`;
    
    // Ensure state has all required fields
    const validatedState = validateState(state);
    
    await redis.setex(
      stateKey, 
      config.redis.ttl.cache || 3600, // 1 hour default
      JSON.stringify(validatedState)
    );
    
    logger.debug('Conversation state updated', {
      conversationId,
      state: validatedState.state,
      queueLength: validatedState.messageQueue.length
    });
  } catch (error) {
    logger.error('Error setting conversation state:', error);
    throw error;
  }
};

/**
 * Create initial state for new conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Object} Initial state object
 */
const createInitialState = (conversationId) => {
  return {
    conversationId,
    state: CONVERSATION_STATES.IDLE,
    messageQueue: [],
    currentlyProcessing: null,
    lastProcessedAt: null,
    processingStartedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

/**
 * Validate and ensure state has all required fields
 * @param {Object} state - State object to validate
 * @returns {Object} Validated state with all required fields
 */
const validateState = (state) => {
  return {
    conversationId: state.conversationId,
    state: state.state || CONVERSATION_STATES.IDLE,
    messageQueue: state.messageQueue || [],
    currentlyProcessing: state.currentlyProcessing || null,
    lastProcessedAt: state.lastProcessedAt || null,
    processingStartedAt: state.processingStartedAt || null,
    createdAt: state.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

/**
 * Check if conversation is stuck in processing state
 * @param {Object} state - Conversation state
 * @returns {boolean} True if stuck
 */
const isProcessingStuck = (state) => {
  if (state.state !== CONVERSATION_STATES.PROCESSING || !state.processingStartedAt) {
    return false;
  }
  
  const processingDuration = getProcessingDuration(state);
  return processingDuration > QUEUE_CONFIG.PROCESSING_TIMEOUT * 1000;
};

/**
 * Get processing duration in milliseconds
 * @param {Object} state - Conversation state
 * @returns {number} Duration in milliseconds
 */
const getProcessingDuration = (state) => {
  if (!state.processingStartedAt) return 0;
  return Date.now() - new Date(state.processingStartedAt).getTime();
};

export default {
  getConversationState,
  setConversationState
};