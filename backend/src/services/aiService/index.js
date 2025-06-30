/**
 * AI Service - Main Entry Point
 * 
 * This module provides the public API for AI response generation.
 * It serves as the single entry point for all AI-related functionality.
 */

// Import the main response generator
import { generateAIResponse } from './responseGenerator.js';

/**
 * Generate AI response for a message
 * @param {Object} params - Generation parameters
 * @param {string} params.conversationId - Conversation ID
 * @param {string} params.userId - User ID
 * @param {string} params.characterId - Character ID
 * @param {Object} params.message - Message object with content
 * @param {string} [params.responseType='text'] - Response type (text, audio, media)
 * @returns {Promise<Object>} AI response with content, metadata, and type info
 * 
 * @example
 * ```javascript
 * const response = await generateAIResponse({
 *   conversationId: 'conv_123',
 *   userId: 'user_456',
 *   characterId: 'char_789',
 *   message: { content: 'Hello!' },
 *   responseType: 'text'
 * });
 * 
 * console.log(response.content); // AI response text
 * console.log(response.aiMetadata); // Generation metadata
 * ```
 */
export { generateAIResponse };

/**
 * Default export for backward compatibility
 * @deprecated Use named exports instead
 */
export default {
  generateAIResponse
};