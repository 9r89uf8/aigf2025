/**
 * Utility Functions for Conversation State Service
 * Shared helper functions and utilities
 */
import logger from '../../utils/logger.js';

/**
 * Format conversation ID from user and character IDs
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @returns {string} Formatted conversation ID
 */
export const formatConversationId = (userId, characterId) => {
  return `${userId}_${characterId}`;
};

/**
 * Parse conversation ID into components
 * @param {string} conversationId - Conversation ID
 * @returns {Object} Parsed components
 */
export const parseConversationId = (conversationId) => {
  const [userId, characterId] = conversationId.split('_');
  return { userId, characterId };
};

/**
 * Calculate message age in seconds
 * @param {string} timestamp - ISO timestamp
 * @returns {number} Age in seconds
 */
export const getMessageAge = (timestamp) => {
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
};

/**
 * Format duration for logging
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

/**
 * Create error response object
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 * @returns {Object} Error response
 */
export const createErrorResponse = (message, code = 'UNKNOWN_ERROR', details = {}) => {
  return {
    success: false,
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Log queue operation
 * @param {string} operation - Operation name
 * @param {Object} data - Operation data
 * @returns {void}
 */
export const logQueueOperation = (operation, data) => {
  logger.debug(`Queue operation: ${operation}`, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

export default {
  formatConversationId,
  parseConversationId,
  getMessageAge,
  formatDuration,
  createErrorResponse,
  logQueueOperation
};