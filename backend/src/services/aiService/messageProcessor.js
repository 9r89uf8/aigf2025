/**
 * Message Processor - Message Array Building and Pattern Optimization
 * 
 * This module handles building message arrays for AI consumption,
 * including system prompts, conversation history, and current messages.
 */

import { generateSystemPrompt } from '../../models/Character.js';
import { reorganizeToAlternatingPattern, handleCurrentMessageWithHistory } from './conversationFormatter.js';
import cache from '../cacheService.js';
import { config } from '../../config/environment.js';
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
/**
 * Validate context has sufficient conversation history
 * @param {Object} context - Conversation context
 * @param {Object} currentMessage - Current message
 * @returns {Object} Validation result
 */
export const validateContext = (context, currentMessage) => {
  const validation = {
    isValid: true,
    warnings: [],
    errors: [],
    suggestions: []
  };
  
  // Check if context exists
  if (!context) {
    validation.isValid = false;
    validation.errors.push('Context is null or undefined');
    return validation;
  }
  
  // Check if messages array exists
  if (!context.messages || !Array.isArray(context.messages)) {
    validation.isValid = false;
    validation.errors.push('Context messages is not an array');
    return validation;
  }
  
  // Check for minimum context
  const minMessages = config.ai?.minContextMessages || 2;
  if (context.messages.length < minMessages) {
    validation.warnings.push(`Context has only ${context.messages.length} messages, minimum recommended is ${minMessages}`);
  }
  
  // Check for excessive LLM error filtering
  const errorMessages = context.messages.filter(m => m.hasLLMError === true);
  if (errorMessages.length > 0) {
    const errorPercentage = (errorMessages.length / context.messages.length) * 100;
    if (errorPercentage > 50) {
      validation.warnings.push(`High percentage of LLM error messages: ${errorPercentage.toFixed(1)}% (${errorMessages.length}/${context.messages.length})`);
      validation.suggestions.push('Consider investigating why so many messages have LLM errors');
    }
  }
  
  // Check for conversation balance
  const userMessages = context.messages.filter(m => m.sender === 'user');
  const aiMessages = context.messages.filter(m => m.sender === 'character');
  
  if (userMessages.length === 0) {
    validation.warnings.push('No user messages in context');
  }
  
  if (aiMessages.length === 0 && userMessages.length > 1) {
    validation.warnings.push('No AI messages in context but multiple user messages present');
  }
  
  // Check current message
  if (!currentMessage || !currentMessage.content) {
    validation.warnings.push('Current message is empty or missing content');
  }
  
  return validation;
};

export const buildMessageArray = async (character, context, currentMessage) => {
  const messages = [];
  
  try {
    // Validate context before processing
    const contextValidation = validateContext(context, currentMessage);
    
    // Log validation results
    if (contextValidation.warnings.length > 0 || contextValidation.errors.length > 0) {
      logger.warn('⚠️ CONTEXT VALIDATION ISSUES detected', {
        characterId: character.id,
        isValid: contextValidation.isValid,
        errors: contextValidation.errors,
        warnings: contextValidation.warnings,
        suggestions: contextValidation.suggestions,
        contextMessageCount: context.messages?.length || 0,
        currentMessageContent: currentMessage.content?.substring(0, 50)
      });
    }
    
    // If context is invalid, create minimal fallback
    if (!contextValidation.isValid) {
      logger.error('❌ CONTEXT VALIDATION FAILED - Creating minimal fallback', {
        characterId: character.id,
        errors: contextValidation.errors
      });
      
      return [
        {
          role: 'system',
          content: await getCachedSystemPrompt(character)
        },
        {
          role: 'user',
          content: currentMessage.content || 'Hello'
        }
      ];
    }
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
    
    // DEBUG: Log message sorting and processing
    logger.debug('🔍 MESSAGE PROCESSING - sorted messages', {
      characterId: character.id,
      originalContextMessages: context.messages?.length || 0,
      sortedMessagesCount: sortedMessages.length,
      sortedMessageDetails: sortedMessages.map(m => ({
        id: m.id,
        sender: m.sender,
        timestamp: m.timestamp,
        content: m.content?.substring(0, 30),
        hasLLMError: m.hasLLMError
      }))
    });

    
    // Reorganize into alternating pattern for AI consumption
    const alternatingMessages = reorganizeToAlternatingPattern(sortedMessages);
    
    // DEBUG: Log pattern reorganization
    logger.debug('🔍 MESSAGE PROCESSING - alternating pattern', {
      characterId: character.id,
      beforeReorganization: sortedMessages.length,
      afterReorganization: alternatingMessages.length,
      alternatingMessageDetails: alternatingMessages.map(m => ({
        id: m.id,
        sender: m.sender,
        content: m.content?.substring(0, 30),
        hasLLMError: m.hasLLMError,
        _combinedMessages: m._combinedMessages
      }))
    });
    
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
    
    // DEBUG: Log final message integration
    logger.debug('🔍 MESSAGE PROCESSING - final messages with current', {
      characterId: character.id,
      alternatingMessagesCount: alternatingMessages.length,
      finalMessagesCount: finalMessages.length,
      currentMessageContent: currentMessage.content?.substring(0, 50),
      finalMessageDetails: finalMessages.map(m => ({
        id: m.id,
        sender: m.sender,
        content: m.content?.substring(0, 30)
      }))
    });
    
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
    
    // DEBUG: Log final AI message array being sent to OpenAI
    logger.debug('🤖 FINAL AI MESSAGE ARRAY for OpenAI', {
      characterId: character.id,
      totalMessages: messages.length,
      systemMessages: messages.filter(m => m.role === 'system').length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      messageArray: messages.map((m, idx) => ({
        index: idx,
        role: m.role,
        contentPreview: m.content?.substring(0, 50) + (m.content?.length > 50 ? '...' : '')
      }))
    });
    
    // Enhanced logging for AI message array being sent to LLM
    logger.info('✅ AI MESSAGE ARRAY SUCCESSFULLY BUILT', {
      totalMessages: messages.length,
      systemMessages: messages.filter(m => m.role === 'system').length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      characterId: character.id,
      tokenSavingsFromFiltering: sortedMessages.length - finalMessages.length,
      contextValidation: contextValidation.isValid ? 'PASSED' : 'FAILED',
      contextWarnings: contextValidation.warnings.length
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