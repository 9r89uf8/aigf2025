/**
 * Queue Manager Module
 * Handles message queue operations (add, get, remove)
 */
import logger from '../../utils/logger.js';
import { CONVERSATION_STATES, QUEUE_CONFIG } from './constants.js';
import { getConversationState, setConversationState } from './stateManager.js';

/**
 * Add message to conversation queue
 * @param {string} conversationId - Conversation ID
 * @param {Object} messageData - Message data to queue
 * @returns {Promise<Object>} Queue status after adding
 */
export const addMessageToQueue = async (conversationId, messageData) => {
  try {
    const state = await getConversationState(conversationId);
    
    // Check queue size limit
    if (state.messageQueue.length >= QUEUE_CONFIG.MAX_QUEUE_SIZE) {
      throw new Error(`Queue full. Maximum ${QUEUE_CONFIG.MAX_QUEUE_SIZE} messages allowed.`);
    }
    
    // Create queue entry with preserved timestamp
    const queueEntry = createQueueEntry(messageData);
    
    // Add to queue
    state.messageQueue.push(queueEntry);
    state.state = state.messageQueue.length > 0 ? CONVERSATION_STATES.QUEUED : state.state;
    
    await setConversationState(conversationId, state);
    
    logger.info('Message added to queue', {
      conversationId,
      messageId: messageData.messageId,
      queuePosition: state.messageQueue.length,
      queueLength: state.messageQueue.length
    });
    
    return {
      success: true,
      queuePosition: state.messageQueue.length,
      queueLength: state.messageQueue.length,
      state: state.state
    };
  } catch (error) {
    logger.error('Error adding message to queue:', error);
    throw error;
  }
};

/**
 * Get next message from queue (FIFO)
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Next message or null if queue empty
 */
export const getNextQueuedMessage = async (conversationId) => {
  try {
    const state = await getConversationState(conversationId);
    
    if (state.messageQueue.length === 0) {
      return null;
    }
    
    // Process expired messages
    await removeExpiredMessages(conversationId, state);
    
    // Re-fetch state after potential cleanup
    const updatedState = await getConversationState(conversationId);
    
    if (updatedState.messageQueue.length === 0) {
      return null;
    }
    
    // Return first message (FIFO)
    return updatedState.messageQueue[0];
  } catch (error) {
    logger.error('Error getting next queued message:', error);
    throw error;
  }
};

/**
 * Remove message from queue after processing
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID to remove
 * @returns {Promise<Object>} Updated queue info
 */
export const removeMessageFromQueue = async (conversationId, messageId) => {
  try {
    const state = await getConversationState(conversationId);
    
    // Remove message from queue
    const originalLength = state.messageQueue.length;
    state.messageQueue = state.messageQueue.filter(msg => msg.messageId !== messageId);
    
    // Update state based on remaining messages
    if (state.messageQueue.length === 0) {
      state.state = CONVERSATION_STATES.IDLE;
      state.currentlyProcessing = null;
    } else if (state.state !== CONVERSATION_STATES.PROCESSING) {
      state.state = CONVERSATION_STATES.QUEUED;
    }
    
    state.lastProcessedAt = new Date().toISOString();
    
    await setConversationState(conversationId, state);
    
    logger.debug('Message removed from queue', {
      conversationId,
      messageId,
      remainingInQueue: state.messageQueue.length,
      wasRemoved: originalLength > state.messageQueue.length
    });
    
    return {
      queueLength: state.messageQueue.length,
      hasMore: state.messageQueue.length > 0,
      state: state.state
    };
  } catch (error) {
    logger.error('Error removing message from queue:', error);
    throw error;
  }
};

/**
 * Create a properly formatted queue entry
 * @param {Object} messageData - Raw message data
 * @returns {Object} Formatted queue entry
 */
const createQueueEntry = (messageData) => {
  return {
    messageId: messageData.messageId,
    userId: messageData.userId,
    characterId: messageData.characterId,
    messageData: messageData.messageData,
    queuedAt: new Date().toISOString(),
    originalTimestamp: messageData.originalTimestamp, // Preserve original WebSocket receive time
    tempId: messageData.tempId
  };
};

/**
 * Remove expired messages from queue
 * @param {string} conversationId - Conversation ID
 * @param {Object} state - Current conversation state
 * @returns {Promise<void>}
 */
const removeExpiredMessages = async (conversationId, state) => {
  const now = Date.now();
  const originalLength = state.messageQueue.length;
  
  // Filter out expired messages
  state.messageQueue = state.messageQueue.filter(msg => {
    const messageAge = now - new Date(msg.queuedAt).getTime();
    const isExpired = messageAge > QUEUE_CONFIG.MESSAGE_TTL * 1000;
    
    if (isExpired) {
      logger.warn('Removing expired message from queue', {
        conversationId,
        messageId: msg.messageId,
        messageAge: Math.floor(messageAge / 1000) + 's'
      });
    }
    
    return !isExpired;
  });
  
  // Update state if messages were removed
  if (state.messageQueue.length !== originalLength) {
    if (state.messageQueue.length === 0 && state.state !== CONVERSATION_STATES.PROCESSING) {
      state.state = CONVERSATION_STATES.IDLE;
    }
    await setConversationState(conversationId, state);
  }
};

export default {
  addMessageToQueue,
  getNextQueuedMessage,
  removeMessageFromQueue
};