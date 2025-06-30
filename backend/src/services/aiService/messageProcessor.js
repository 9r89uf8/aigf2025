/**
 * Message Processor - Message Array Building and Pattern Optimization
 * 
 * This module handles building message arrays for AI consumption,
 * including system prompts, conversation history, and current messages.
 */

import { generateSystemPrompt } from '../../models/Character.js';
import { reorganizeToAlternatingPattern, handleCurrentMessageWithHistory } from './conversationFormatter.js';
import cache from '../cacheService.js';
import logger from '../../utils/logger.js';

/**
 * Get cached system prompt for character
 * @param {Object} character - Character data
 * @returns {Promise<string>} Generated system prompt
 */
const getCachedSystemPrompt = async (character) => {
  const cacheKey = cache.keys.characterPrompt(character.id);
  
  return await cache.getOrSet(cacheKey, async () => {
    logger.debug('Generating system prompt for character', {
      characterId: character.id,
      hasPersonality: !!character.personality
    });
    
    return generateSystemPrompt(character);
  }, 7200); // Cache for 2 hours - character prompts rarely change
};

/**
 * Build message array for AI with alternating pattern optimization
 * Reorganizes chronological messages into strict user→assistant→user pattern
 * @param {Object} character - Character data
 * @param {Object} context - Conversation context with messages
 * @param {Object} currentMessage - Current message being processed
 * @returns {Array} Formatted message array for AI consumption
 */
export const buildMessageArray = async (character, context, currentMessage) => {
  const messages = [];
  
  try {
    // System prompt with caching
    const systemPrompt = await getCachedSystemPrompt(character);
    messages.push({
      role: 'system',
      content: systemPrompt
    });
    
    // Add character knowledge base if available
    if (character.aiSettings?.knowledgeBase?.length > 0) {
      messages.push({
        role: 'system',
        content: `Character Knowledge:\n${character.aiSettings.knowledgeBase.join('\n')}`
      });
    }
    
    // Sort messages chronologically (ensure proper ordering)
    const sortedMessages = [...context.messages].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    
    // Reorganize into alternating pattern for AI consumption
    const alternatingMessages = reorganizeToAlternatingPattern(sortedMessages);
    
    // Log pattern reorganization for debugging
    if (sortedMessages.length !== alternatingMessages.length) {
      logger.debug('Message pattern reorganized for AI', {
        originalCount: sortedMessages.length,
        reorganizedCount: alternatingMessages.length,
        hasCombinedMessages: alternatingMessages.some(msg => msg._combinedMessages)
      });
    }
    
    // Add reorganized conversation history and handle current message
    const finalMessages = handleCurrentMessageWithHistory(alternatingMessages, currentMessage);
    
    // Validate that we still have proper conversation flow after filtering
    const userMessageCount = finalMessages.filter(msg => msg.sender === 'user').length;
    const aiMessageCount = finalMessages.filter(msg => msg.sender === 'character').length;
    
    logger.debug('Conversation context after LLM error filtering', {
      originalContextMessages: sortedMessages.length,
      filteredContextMessages: finalMessages.length,
      userMessages: userMessageCount,
      aiMessages: aiMessageCount,
      hasCurrentMessage: !!currentMessage.content
    });
    
    finalMessages.forEach(msg => {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content || '[Non-text message]'
      });
    });
    
    // Enhanced logging for AI message array being sent to LLM
    logger.debug('AI message array built', {
      totalMessages: messages.length,
      systemMessages: messages.filter(m => m.role === 'system').length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      characterId: character.id,
      tokenSavingsFromFiltering: sortedMessages.length - finalMessages.length
    });
    
    // Detailed logging for debugging (can be disabled in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('\n=== AI MESSAGE ARRAY ===');
      console.log(JSON.stringify(messages, null, 2));
      console.log('=== END MESSAGE ARRAY ===\n');
    }
    
    return messages;
    
  } catch (error) {
    logger.error('Error building message array:', {
      error: error.message,
      characterId: character.id,
      contextMessageCount: context.messages?.length || 0,
      currentMessageContent: currentMessage.content?.substring(0, 100)
    });
    
    // Return minimal message array as fallback
    return [
      {
        role: 'system',
        content: generateSystemPrompt(character)
      },
      {
        role: 'user',
        content: currentMessage.content || 'Hello'
      }
    ];
  }
};

/**
 * Validate message array for AI consumption
 * @param {Array} messages - Message array to validate
 * @returns {Object} Validation result
 */
export const validateMessageArray = (messages) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  // Check if messages array exists and is not empty
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    validation.isValid = false;
    validation.errors.push('Messages array is empty or invalid');
    return validation;
  }
  
  // Check if first message is system message
  if (messages[0].role !== 'system') {
    validation.warnings.push('First message should be a system message');
  }
  
  // Check for valid roles
  const validRoles = ['system', 'user', 'assistant'];
  messages.forEach((msg, index) => {
    if (!validRoles.includes(msg.role)) {
      validation.isValid = false;
      validation.errors.push(`Invalid role "${msg.role}" at index ${index}`);
    }
    
    if (!msg.content || typeof msg.content !== 'string') {
      validation.isValid = false;
      validation.errors.push(`Invalid or missing content at index ${index}`);
    }
  });
  
  // Check for proper alternating pattern (after system messages)
  const conversationMessages = messages.filter(msg => msg.role !== 'system');
  for (let i = 0; i < conversationMessages.length - 1; i++) {
    const current = conversationMessages[i];
    const next = conversationMessages[i + 1];
    
    // Warn about consecutive messages from same role
    if (current.role === next.role) {
      validation.warnings.push(`Consecutive ${current.role} messages at conversation index ${i} and ${i + 1}`);
    }
  }
  
  // Check total message count
  if (messages.length > 50) {
    validation.warnings.push(`Large message count (${messages.length}) may impact performance`);
  }
  
  return validation;
};

/**
 * Get message statistics for monitoring
 * @param {Array} messages - Message array
 * @returns {Object} Message statistics
 */
export const getMessageStats = (messages) => {
  if (!messages || !Array.isArray(messages)) {
    return { error: 'Invalid messages array' };
  }
  
  const stats = {
    total: messages.length,
    byRole: {
      system: 0,
      user: 0,
      assistant: 0
    },
    totalCharacters: 0,
    averageLength: 0,
    longestMessage: 0,
    shortestMessage: Infinity
  };
  
  messages.forEach(msg => {
    // Count by role
    if (stats.byRole.hasOwnProperty(msg.role)) {
      stats.byRole[msg.role]++;
    }
    
    // Calculate lengths
    const length = msg.content?.length || 0;
    stats.totalCharacters += length;
    stats.longestMessage = Math.max(stats.longestMessage, length);
    stats.shortestMessage = Math.min(stats.shortestMessage, length);
  });
  
  stats.averageLength = stats.total > 0 ? Math.round(stats.totalCharacters / stats.total) : 0;
  stats.shortestMessage = stats.shortestMessage === Infinity ? 0 : stats.shortestMessage;
  
  return stats;
};