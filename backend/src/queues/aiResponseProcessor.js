/**
 * AI Response Queue Processor
 * Processes AI response generation jobs
 */
import { generateAIResponse } from '../services/aiService.js';
import { handleAIResponse } from '../handlers/messageHandler.js';
import { handleAIResponseComplete } from '../services/messageQueueProcessor.js';
import { calculateTokenCost } from '../config/deepseek.js';
import cacheService from '../services/cacheService.js';
import { getRedisClient } from '../config/redis.js';
import { likeMessage, updateMessage } from '../services/conversationService.js';
import { getSocketIO } from '../config/socket.js';
import logger from '../utils/logger.js';

/**
 * Process AI response generation job
 * @param {Object} job - Bull job
 * @returns {Promise<Object>} Processing result
 */
export const processAIResponse = async (job) => {
  const { 
    conversationId, 
    messageId, 
    userId, 
    characterId, 
    character, 
    message,
    isRetry = false
  } = job.data;
  
  logger.info('Processing AI response job', {
    jobId: job.id,
    conversationId,
    messageId,
    characterId,
    isRetry
  });
  
  try {
    // Check if response already exists (duplicate job) - skip for retries
    const responseKey = `ai_response:${conversationId}:${messageId}`;
    if (!isRetry) {
      const existingResponse = await cacheService.get(responseKey);
      if (existingResponse) {
        logger.warn('AI response already generated', { messageId });
        return { success: true, duplicate: true };
      }
    } else {
      // For retries, clear any existing cache to force fresh generation
      await cacheService.del(responseKey);
      logger.debug('Cleared existing AI response cache for retry', { messageId });
    }
    
    // Determine response type based on message
    const responseType = getResponseType(message, character);
    
    // Generate AI response
    const aiResponse = await generateAIResponse({
      conversationId,
      userId,
      characterId,
      message,
      responseType
    });
    
    // Cache response to prevent duplicates
    await cacheService.set(responseKey, aiResponse, 300); // 5 minutes
    
    // AI auto-like logic: 25% chance to like the user's message
    await handleAIAutoLike({
      conversationId,
      userId,
      characterId,
      userMessageId: messageId,
      character
    });
    
    // Send response through Socket.io
    await handleAIResponse({
      conversationId,
      userId,
      characterId,
      response: aiResponse.content,
      responseType: aiResponse.type,
      audioUrl: aiResponse.audioUrl,
      mediaItem: aiResponse.mediaItem,
      aiMetadata: aiResponse.aiMetadata,
      replyToMessageId: messageId // Link AI response to original user message
    });
    
    // Track token usage if available
    if (aiResponse.aiMetadata?.tokens) {
      await trackTokenUsage({
        userId,
        characterId,
        tokens: aiResponse.aiMetadata.tokens,
        model: aiResponse.aiMetadata.model,
        cost: calculateTokenCost(
          aiResponse.aiMetadata.tokens.prompt_tokens || 0,
          aiResponse.aiMetadata.tokens.completion_tokens || 0,
          aiResponse.aiMetadata.model
        )
      });
    }
    
    // Update job progress
    await job.progress(100);
    
    // Trigger next message processing from queue
    await handleAIResponseComplete(conversationId);
    
    logger.info('AI response job completed', {
      jobId: job.id,
      conversationId,
      processingTime: aiResponse.aiMetadata?.processingTime
    });
    
    return {
      success: true,
      response: aiResponse,
      processingTime: aiResponse.aiMetadata?.processingTime
    };
    
  } catch (error) {
    logger.error('AI response job failed', {
      jobId: job.id,
      conversationId,
      // error: error.message
    });
    
    // Check if this is an LLM error from qualityControl.js
    const isLLMError = error && typeof error === 'object' && error.isLLMError === true;
    
    if (isLLMError) {
      // For LLM errors, don't send an AI response - let frontend handle user message error state
      logger.warn('LLM provider failed, not sending AI response', {
        jobId: job.id,
        conversationId,
        messageId,
        // errorType: error.errorType,
        // originalError: error.originalError
      });
      
      // Persist LLM error state to database so it survives page refresh
      try {
        await updateMessage(conversationId, messageId, {
          hasLLMError: true,
          errorType: error.errorType,
          errorTimestamp: error.timestamp || Date.now(),
          originalError: error.originalError
        });
        logger.debug('LLM error state persisted to database', { conversationId, messageId });
      } catch (updateError) {
        logger.error('Failed to persist LLM error state:', updateError);
      }
      
      // Send error metadata to frontend via Socket.io for proper error handling
      const io = getSocketIO();
      if (io) {
        io.to(`conversation:${conversationId}`).emit('message:llm_error', {
          conversationId,
          messageId,
          errorType: error.errorType,
          isLLMError: true,
          timestamp: error.timestamp || Date.now()
        });
      }
    } else {
      // For other errors, send error message as AI response
      await handleAIResponse({
        conversationId,
        userId,
        characterId,
        response: getErrorMessage(error),
        responseType: 'text',
        aiMetadata: {
          error: true,
          errorMessage: error.message
        },
        replyToMessageId: messageId // Link error response to original user message
      });
    }
    
    // Even on error, trigger next message processing
    try {
      await handleAIResponseComplete(conversationId);
    } catch (nextError) {
      logger.error('Error triggering next message after AI error:', nextError);
    }
    
    throw error;
  }
};

/**
 * Determine response type based on message and character settings
 * @private
 */
const getResponseType = (message, character) => {
  // If user sent audio, respond with audio if character supports it
  if (message.type === 'audio' && character.voiceSettings?.enabled) {
    return 'audio';
  }
  
  // If user requested media or character has media preference
  if (message.type === 'media' || shouldSendMedia(message.content, character)) {
    return 'media';
  }
  
  // Default to text
  return 'text';
};

/**
 * Check if media should be sent based on message content
 * @private
 */
const shouldSendMedia = (content, character) => {
  if (!content || !character.gallery?.length) {
    return false;
  }
  
  // Keywords that might trigger media response
  const mediaKeywords = [
    'show', 'picture', 'photo', 'image', 'see', 'look',
    'gif', 'video', 'visual', 'selfie', 'pic'
  ];
  
  const contentLower = content.toLowerCase();
  const hasMediaKeyword = mediaKeywords.some(keyword => 
    contentLower.includes(keyword)
  );
  
  // Random chance for premium characters
  const randomChance = character.isPremium && Math.random() < 0.1; // 10% chance
  
  return hasMediaKeyword || randomChance;
};

/**
 * Get user-friendly error message
 * @private
 */
const getErrorMessage = (error) => {
  const errorMessages = {
    'AI service quota exceeded': "I'm a bit overwhelmed right now. Please try again in a moment! 💫",
    'Character not found': "Oops! I seem to have gotten lost. Please refresh and try again.",
    'DeepSeek client not initialized': "I'm having technical difficulties. The team has been notified!",
    'Rate limit exceeded': "Whoa, slow down there! Let's take a breather and chat again in a bit. 😊"
  };
  
  return errorMessages[error.message] || 
    "Something went wrong, but don't worry! Let's try that again. 🌟";
};

/**
 * Track token usage for analytics
 * @private
 */
const trackTokenUsage = async ({ userId, characterId, tokens, model, cost }) => {
  try {
    const key = `token_usage:${userId}:${new Date().toISOString().split('T')[0]}`;
    const usage = {
      characterId,
      model,
      promptTokens: tokens.prompt_tokens || 0,
      completionTokens: tokens.completion_tokens || 0,
      totalTokens: tokens.total_tokens || 0,
      cost,
      timestamp: new Date()
    };
    
    // Store in Redis for daily aggregation
    await getRedisClient().lpush(key, JSON.stringify(usage));
    await getRedisClient().expire(key, 86400 * 7); // Keep for 7 days
    
    logger.debug('Token usage tracked', { userId, characterId, totalTokens: usage.totalTokens });
  } catch (error) {
    logger.error('Failed to track token usage:', error);
  }
};

/**
 * Handle AI auto-like functionality
 * AI likes user messages 25% of the time with natural timing
 * @private
 */
const handleAIAutoLike = async ({ conversationId, userId, characterId, userMessageId, character }) => {
  try {
    logger.info('AI auto-like triggered', { conversationId, userId, characterId, userMessageId });
    logger.info('AI will attempt to like message with ID: ' + userMessageId);
    
    // 25% chance to like the user's message
    const shouldLike = Math.random() < 0.35;
    
    logger.info('AI auto-like probability check', { shouldLike, probability: 0.85 });
    
    if (!shouldLike) {
      logger.info('AI decided not to like this message');
      return;
    }
    
    // Add natural delay (1-3 seconds) to make it feel more human
    const delay = Math.random() * 2000 + 1000; // 1-3 seconds
    
    logger.info('AI will like message with delay', { delay: Math.round(delay) });
    
    setTimeout(async () => {
      try {
        // Create AI user ID for likes (use character ID as AI "user")
        const aiUserId = `ai_${characterId}`;
        
        logger.info('Attempting to like user message', { 
          conversationId, 
          userMessageId, 
          aiUserId 
        });
        
        // Like the user's message
        await likeMessage(conversationId, userMessageId, aiUserId, true);
        
        logger.info('Successfully liked user message in database');
        
        // Send real-time notification via WebSocket
        const io = getSocketIO();
        if (io) {
          const likesEvent = {
            conversationId,
            messageId: userMessageId,
            likedBy: aiUserId,
            isLiked: true,
            isAILike: true,
            characterName: character.name || 'AI'
          };
          
          logger.info('Sending WebSocket event to user', { 
            userId, 
            event: 'message:liked', 
            likesEvent 
          });
          
          // Send to user
          io.to(`user:${userId}`).emit('message:liked', likesEvent);
          
          logger.info('WebSocket event sent successfully');
        } else {
          logger.error('Socket.io not available');
        }
        
        logger.info('AI auto-liked user message completed', {
          conversationId,
          userMessageId,
          characterId,
          delay: Math.round(delay)
        });
      } catch (error) {
        logger.error('Failed to auto-like user message:', error);
      }
    }, delay);
    
  } catch (error) {
    logger.error('Error in AI auto-like handler:', error);
  }
};

/**
 * Queue configuration for AI response jobs
 */
export const aiResponseQueueConfig = {
  name: 'ai-responses',
  processor: processAIResponse,
  options: {
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 100
    },
    removeOnFail: {
      age: 86400 // 24 hours
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
};

export default processAIResponse; 