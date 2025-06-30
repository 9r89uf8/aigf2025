/**
 * Processing Manager Module
 * Handles conversation processing state management
 */
import logger from '../../utils/logger.js';
import { CONVERSATION_STATES } from './constants.js';
import { getConversationState, setConversationState } from './stateManager.js';

/**
 * Set conversation to processing state
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID being processed
 * @returns {Promise<void>}
 */
export const setConversationProcessing = async (conversationId, messageId) => {
  try {
    const state = await getConversationState(conversationId);
    
    // Check if we need to reset first
    if (state.needsReset) {
      await resetConversationProcessing(conversationId);
      // Re-fetch state after reset
      const resetState = await getConversationState(conversationId);
      return await setConversationProcessing(conversationId, messageId);
    }
    
    state.state = CONVERSATION_STATES.PROCESSING;
    state.currentlyProcessing = messageId;
    state.processingStartedAt = new Date().toISOString();
    
    await setConversationState(conversationId, state);
    
    logger.debug('Conversation set to processing', {
      conversationId,
      messageId,
      processingStartedAt: state.processingStartedAt
    });
  } catch (error) {
    logger.error('Error setting conversation to processing:', error);
    throw error;
  }
};

/**
 * Reset conversation from processing state
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
export const resetConversationProcessing = async (conversationId) => {
  try {
    const state = await getConversationState(conversationId);
    
    // Determine new state based on queue
    state.state = state.messageQueue.length > 0 ? CONVERSATION_STATES.QUEUED : CONVERSATION_STATES.IDLE;
    state.currentlyProcessing = null;
    state.processingStartedAt = null;
    state.lastProcessedAt = new Date().toISOString();
    
    // Remove needsReset flag if present
    delete state.needsReset;
    
    await setConversationState(conversationId, state);
    
    logger.debug('Conversation processing reset', {
      conversationId,
      newState: state.state,
      queueLength: state.messageQueue.length
    });
  } catch (error) {
    logger.error('Error resetting conversation processing:', error);
    throw error;
  }
};

/**
 * Check if conversation can process new message immediately
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>} True if can process immediately
 */
export const canProcessImmediately = async (conversationId) => {
  try {
    const state = await getConversationState(conversationId);
    
    // Can process if idle or if stuck in processing
    if (state.state === CONVERSATION_STATES.IDLE) {
      return true;
    }
    
    // If stuck in processing, it can be reset and then process
    if (state.needsReset) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking if can process immediately:', error);
    return false;
  }
};

/**
 * Complete message processing
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID that was processed
 * @returns {Promise<void>}
 */
export const completeMessageProcessing = async (conversationId, messageId) => {
  try {
    const state = await getConversationState(conversationId);
    
    // Verify we're processing the expected message
    if (state.currentlyProcessing !== messageId) {
      logger.warn('Completing processing for unexpected message', {
        conversationId,
        expectedMessageId: state.currentlyProcessing,
        actualMessageId: messageId
      });
    }
    
    // Update state based on remaining queue
    state.state = state.messageQueue.length > 0 ? CONVERSATION_STATES.QUEUED : CONVERSATION_STATES.IDLE;
    state.currentlyProcessing = null;
    state.processingStartedAt = null;
    state.lastProcessedAt = new Date().toISOString();
    
    await setConversationState(conversationId, state);
    
    logger.debug('Message processing completed', {
      conversationId,
      messageId,
      newState: state.state
    });
  } catch (error) {
    logger.error('Error completing message processing:', error);
    throw error;
  }
};

export default {
  setConversationProcessing,
  resetConversationProcessing,
  canProcessImmediately,
  completeMessageProcessing
};