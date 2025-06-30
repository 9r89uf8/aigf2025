/**
 * Conversation State Service
 * Main export file providing unified API for conversation state management
 * 
 * This service manages conversation states and message queuing for natural messaging flow
 * References: NATURAL_MESSAGE_QUEUING_PLAN.md - Phase 1
 */

// Import all modules
import { CONVERSATION_STATES, QUEUE_CONFIG, REDIS_KEYS } from './constants.js';
import { getConversationState, setConversationState } from './stateManager.js';
import { addMessageToQueue, getNextQueuedMessage, removeMessageFromQueue } from './queueManager.js';
import { 
  setConversationProcessing, 
  resetConversationProcessing, 
  canProcessImmediately,
  completeMessageProcessing 
} from './processingManager.js';
import { 
  cleanupExpiredMessages, 
  initializeCleanup, 
  stopCleanup,
  cleanupConversation 
} from './cleanupManager.js';
import { 
  getQueueStatus, 
  getAllConversationStates,
  getConversationStats 
} from './statusManager.js';
import utils from './utils.js';

// Export constants
export { CONVERSATION_STATES };

// Export individual functions for backward compatibility
export {
  // State management
  getConversationState,
  setConversationState,
  
  // Queue management
  addMessageToQueue,
  getNextQueuedMessage,
  removeMessageFromQueue,
  
  // Processing management
  setConversationProcessing,
  resetConversationProcessing,
  canProcessImmediately,
  completeMessageProcessing,
  
  // Cleanup management
  cleanupExpiredMessages,
  initializeCleanup,
  stopCleanup,
  cleanupConversation,
  
  // Status management
  getQueueStatus,
  getAllConversationStates,
  getConversationStats,
  
  // Utilities
  utils
};

// Default export with all functions grouped by module
export default {
  // Constants
  CONVERSATION_STATES,
  QUEUE_CONFIG,
  REDIS_KEYS,
  
  // State operations
  getConversationState,
  setConversationState,
  
  // Queue operations
  addMessageToQueue,
  getNextQueuedMessage,
  removeMessageFromQueue,
  
  // Processing operations
  setConversationProcessing,
  resetConversationProcessing,
  canProcessImmediately,
  completeMessageProcessing,
  
  // Cleanup operations
  cleanupExpiredMessages,
  initializeCleanup,
  stopCleanup,
  cleanupConversation,
  
  // Status operations
  getQueueStatus,
  getAllConversationStates,
  getConversationStats,
  
  // Utility functions
  utils
};