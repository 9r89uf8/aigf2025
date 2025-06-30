/**
 * Conversation Formatter - Alternating Pattern Logic and Message Combination
 * 
 * This module handles formatting conversation history into AI-friendly patterns,
 * specifically creating alternating user→assistant→user patterns and combining
 * consecutive messages appropriately.
 */

import logger from '../../utils/logger.js';

/**
 * Reorganize chronological messages into alternating user→assistant pattern
 * Handles multiple consecutive user messages by grouping them appropriately
 * Filters out messages with LLM errors to prevent token waste
 * @param {Array} chronologicalMessages - Messages sorted by timestamp
 * @returns {Array} Messages reorganized in alternating pattern
 */
export const reorganizeToAlternatingPattern = (chronologicalMessages) => {
  if (!chronologicalMessages || chronologicalMessages.length === 0) {
    return [];
  }

  // Filter out messages with LLM errors to save tokens and prevent confusion
  const filteredMessages = chronologicalMessages.filter(message => {
    if (message.hasLLMError === true) {
      logger.debug('Filtering out message with LLM error from AI context', {
        messageId: message.id,
        errorType: message.errorType,
        content: message.content?.substring(0, 50)
      });
      return false;
    }
    return true;
  });
  
  // Log filtering results for monitoring
  const filteredCount = chronologicalMessages.length - filteredMessages.length;
  if (filteredCount > 0) {
    logger.info('Filtered LLM error messages from AI context', {
      originalCount: chronologicalMessages.length,
      filteredCount,
      remainingCount: filteredMessages.length
    });
  }

  
  const alternatingMessages = [];
  let pendingUserMessages = []; // Buffer for consecutive user messages
  
  for (const message of filteredMessages) {
    // Handle edge case: unknown sender types
    if (!message.sender || !['user', 'character'].includes(message.sender)) {
      logger.warn('Unknown message sender type, skipping message', {
        sender: message.sender,
        messageId: message.id,
        type: message.type
      });
      continue;
    }
    
    if (message.sender === 'user') {
      // Collect user messages
      pendingUserMessages.push(message);
    } else if (message.sender === 'character') {
      // AI response - process any pending user messages first
      if (pendingUserMessages.length > 0) {
        // Add combined user messages (for multiple rapid messages)
        const combinedUserMessage = combineConsecutiveUserMessages(pendingUserMessages);
        if (combinedUserMessage) {
          alternatingMessages.push(combinedUserMessage);
        }
        pendingUserMessages = [];
      }
      
      // Add AI response
      alternatingMessages.push(message);
    }
  }
  
  // Handle any remaining user messages at the end
  if (pendingUserMessages.length > 0) {
    const combinedUserMessage = combineConsecutiveUserMessages(pendingUserMessages);
    if (combinedUserMessage) {
      alternatingMessages.push(combinedUserMessage);
    }
  }
  
  // Edge case: Conversation starts with AI message (shouldn't happen but handle gracefully)
  if (alternatingMessages.length > 0 && alternatingMessages[0].sender === 'character') {
    logger.warn('Conversation starts with AI message, adding context note', {
      firstMessageId: alternatingMessages[0].id
    });
    // Keep as-is but log for monitoring
  }
  
  return alternatingMessages;
};

/**
 * Combine multiple consecutive user messages into a single message for AI context
 * @param {Array} userMessages - Array of consecutive user messages
 * @returns {Object|null} Combined message or null if invalid input
 */
export const combineConsecutiveUserMessages = (userMessages) => {
  if (!userMessages || userMessages.length === 0) {
    logger.warn('Empty user messages array passed to combineConsecutiveUserMessages');
    return null;
  }
  
  if (userMessages.length === 1) {
    return userMessages[0];
  }
  
  // Filter out messages with no content (edge case handling)
  const validMessages = userMessages.filter(msg => 
    msg.content && msg.content.trim().length > 0
  );
  
  if (validMessages.length === 0) {
    // All messages were empty, return the first one with fallback content
    return {
      ...userMessages[0],
      content: '[Multiple non-text messages]',
      _combinedMessages: userMessages.length
    };
  }
  
  if (validMessages.length === 1) {
    return validMessages[0];
  }
  
  // Combine multiple user messages with clear separation
  const combinedContent = validMessages
    .map((msg, index) => {
      const content = msg.content || '[Non-text message]';
      return validMessages.length > 2 ? `${index + 1}. ${content}` : content;
    })
    .join('\n\n');
  
  // Use the first valid message as base, but with combined content
  return {
    ...validMessages[0],
    content: combinedContent,
    _combinedMessages: userMessages.length, // For debugging/logging
    _validMessages: validMessages.length
  };
};

/**
 * Handle current message with conversation history to maintain alternating pattern
 * @param {Array} alternatingMessages - Messages already in alternating pattern
 * @param {Object} currentMessage - Current message being processed
 * @returns {Array} Final message array with current message integrated
 */
export const handleCurrentMessageWithHistory = (alternatingMessages, currentMessage) => {
  const messages = [...alternatingMessages];
  
  // Check if the current message is already the last message in history
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && 
      lastMessage.content === currentMessage.content && 
      lastMessage.sender === 'user') {
    // Current message is already in history, don't add it again
    logger.debug('Current message already in history, skipping duplicate', {
      messageContent: currentMessage.content?.substring(0, 50),
      historyLength: messages.length
    });
    return messages;
  }
  
  // Check if last message in history is from user (but not the current message)
  if (messages.length > 0 && messages[messages.length - 1].sender === 'user') {
    // Combine current message with the last user message
    const lastUserMessage = messages[messages.length - 1];
    const combinedMessage = {
      ...lastUserMessage,
      content: `${lastUserMessage.content}\n\n${currentMessage.content}`,
      _combinedWithCurrent: true
    };
    
    // Replace the last message with the combined one
    messages[messages.length - 1] = combinedMessage;
    
    logger.debug('Combined current message with last user message', {
      originalContentPreview: lastUserMessage.content?.substring(0, 50),
      currentContentPreview: currentMessage.content?.substring(0, 50)
    });
  } else {
    // Safe to add current message as separate user message
    messages.push({
      sender: 'user',
      content: currentMessage.content,
      timestamp: new Date(), // Current message timestamp
      id: currentMessage.id || `current_${Date.now()}`
    });
  }
  
  return messages;
};

/**
 * Validate conversation pattern for quality assurance
 * @param {Array} messages - Messages to validate
 * @returns {Object} Validation results
 */
export const validateConversationPattern = (messages) => {
  const validation = {
    isValid: true,
    issues: [],
    suggestions: []
  };
  
  if (!messages || messages.length === 0) {
    validation.isValid = false;
    validation.issues.push('No messages to validate');
    return validation;
  }
  
  // Check for proper alternating pattern
  let lastSender = null;
  let consecutiveCount = 0;
  
  messages.forEach((msg, index) => {
    if (msg.sender === lastSender) {
      consecutiveCount++;
      if (consecutiveCount >= 2) {
        validation.issues.push(`Multiple consecutive messages from ${msg.sender} starting at index ${index - consecutiveCount}`);
      }
    } else {
      consecutiveCount = 0;
      lastSender = msg.sender;
    }
  });
  
  // Check for empty or very short messages
  messages.forEach((msg, index) => {
    if (!msg.content || msg.content.trim().length < 2) {
      validation.issues.push(`Very short or empty message at index ${index}`);
    }
  });
  
  // Check conversation balance
  const userMessages = messages.filter(msg => msg.sender === 'user').length;
  const aiMessages = messages.filter(msg => msg.sender === 'character').length;
  const ratio = userMessages / Math.max(aiMessages, 1);
  
  if (ratio > 3) {
    validation.suggestions.push('Many user messages without AI responses - conversation may be imbalanced');
  } else if (ratio < 0.5) {
    validation.suggestions.push('Many AI messages without user input - check for proper user engagement');
  }
  
  validation.isValid = validation.issues.length === 0;
  
  return validation;
};

/**
 * Get conversation statistics for analysis
 * @param {Array} messages - Messages to analyze
 * @returns {Object} Conversation statistics
 */
export const getConversationStats = (messages) => {
  if (!messages || !Array.isArray(messages)) {
    return { error: 'Invalid messages array' };
  }
  
  const stats = {
    totalMessages: messages.length,
    userMessages: 0,
    aiMessages: 0,
    combinedMessages: 0,
    averageUserLength: 0,
    averageAiLength: 0,
    longestUserMessage: 0,
    longestAiMessage: 0,
    conversationSpan: null
  };
  
  let userLengthSum = 0;
  let aiLengthSum = 0;
  const timestamps = [];
  
  messages.forEach(msg => {
    // Count message types
    if (msg.sender === 'user') {
      stats.userMessages++;
      const length = msg.content?.length || 0;
      userLengthSum += length;
      stats.longestUserMessage = Math.max(stats.longestUserMessage, length);
    } else if (msg.sender === 'character') {
      stats.aiMessages++;
      const length = msg.content?.length || 0;
      aiLengthSum += length;
      stats.longestAiMessage = Math.max(stats.longestAiMessage, length);
    }
    
    // Count combined messages
    if (msg._combinedMessages) {
      stats.combinedMessages++;
    }
    
    // Collect timestamps
    if (msg.timestamp) {
      timestamps.push(new Date(msg.timestamp));
    }
  });
  
  // Calculate averages
  stats.averageUserLength = stats.userMessages > 0 ? Math.round(userLengthSum / stats.userMessages) : 0;
  stats.averageAiLength = stats.aiMessages > 0 ? Math.round(aiLengthSum / stats.aiMessages) : 0;
  
  // Calculate conversation span
  if (timestamps.length >= 2) {
    const sortedTimestamps = timestamps.sort();
    const span = sortedTimestamps[sortedTimestamps.length - 1] - sortedTimestamps[0];
    stats.conversationSpan = {
      milliseconds: span,
      minutes: Math.round(span / (1000 * 60)),
      hours: Math.round(span / (1000 * 60 * 60))
    };
  }
  
  return stats;
};