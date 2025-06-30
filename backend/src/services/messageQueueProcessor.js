/**
 * Message Queue Processor Service
 * Handles FIFO queue processing for natural messaging flow
 * 
 * References: NATURAL_MESSAGE_QUEUING_PLAN.md - Phase 1
 */
import {
  getConversationState,
  getNextQueuedMessage,
  removeMessageFromQueue,
  setConversationProcessing,
  resetConversationProcessing,
  canProcessImmediately,
  getQueueStatus,
  CONVERSATION_STATES
} from './conversationStateService/index.js';
import { 
  addMessage,
  canSendMessage
} from './conversationService.js';
import { getCharacterById } from './characterService.js';
import { incrementUsage } from './usageService.js';
import { validateMessage } from '../models/Conversation.js';
import { queueHelpers } from '../config/queues.js';
import { getSocketIO, SOCKET_EVENTS } from '../config/socket.js';
import logger from '../utils/logger.js';

/**
 * Process user message - either immediately or add to queue
 * @param {Object} messageData - Message data from WebSocket
 * @param {Object} socket - Socket.io socket instance
 * @returns {Promise<Object>} Processing result
 */
export const processUserMessage = async (messageData, socket, originalTimestamp) => {
  const { characterId, type = 'text', content, audioData, mediaData, messageId } = messageData;
  const userId = socket.userId;
  const conversationId = `${userId}_${characterId}`;
  
  try {
    logger.debug('Processing user message', {
      conversationId,
      userId,
      characterId,
      type,
      messageId
    });
    
    // Validate character exists
    const character = await getCharacterById(characterId);
    if (!character) {
      throw new Error('Character not found');
    }
    
    // Check usage limits
    const usage = await canSendMessage(userId, characterId, type, socket.user.isPremium);
    if (!usage.canSend) {
      socket.emit(SOCKET_EVENTS.USAGE_LIMIT, {
        characterId,
        messageType: type,
        ...usage
      });
      
      return { 
        success: false, 
        error: 'Message limit reached',
        usage 
      };
    }
    
    // Create and validate message
    const messagePayload = {
      sender: 'user',
      type,
      content: type === 'text' ? content : null,
      audioData: type === 'audio' ? audioData : null,
      mediaData: type === 'media' ? mediaData : null
    };
    
    const validation = validateMessage(messagePayload);
    if (!validation.isValid) {
      return { 
        success: false, 
        error: validation.errors.join(', ') 
      };
    }
    
    // Check if conversation can process immediately
    const canProcess = await canProcessImmediately(conversationId);
    
    if (canProcess) {
      // Process immediately
      logger.debug('Processing message immediately', { conversationId, messageId });
      return await processMessageImmediately({
        conversationId,
        userId,
        characterId,
        character,
        messagePayload,
        messageId,
        socket,
        originalTimestamp
      });
    } else {
      // Add to queue
      logger.debug('Adding message to queue', { conversationId, messageId });
      return await addMessageToQueueForProcessing({
        conversationId,
        userId,
        characterId,
        messagePayload,
        messageId,
        socket,
        originalTimestamp
      });
    }
    
  } catch (error) {
    logger.error('Error processing user message:', error);
    return { 
      success: false, 
      error: 'Failed to process message' 
    };
  }
};

/**
 * Process message immediately (conversation is idle)
 * @private
 */
const processMessageImmediately = async ({
  conversationId,
  userId,
  characterId,
  character,
  messagePayload,
  messageId,
  socket,
  originalTimestamp
}) => {
  try {
    // Set conversation to processing
    await setConversationProcessing(conversationId, messageId);
    
    // Add message to conversation with preserved timestamp and provided ID
    const savedMessage = await addMessage(conversationId, messagePayload, originalTimestamp, messageId);
    
    // Increment Redis usage tracking for rate limiting and display
    try {
      await incrementUsage(userId, characterId, messagePayload.type);
      logger.debug('Redis usage incremented via WebSocket', { userId, characterId, type: messagePayload.type });
    } catch (usageError) {
      logger.error('Failed to increment Redis usage (non-blocking):', usageError);
      // Don't fail the message processing if Redis usage tracking fails
    }
    
    // Emit message to conversation room
    const io = getSocketIO();
    io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_RECEIVE, {
      message: savedMessage,
      conversationId
    });
    
    // Emit processing status
    io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_PROCESSING, {
      messageId: savedMessage.id,
      conversationId,
      processingStartedAt: new Date().toISOString()
    });
    
    // Queue AI response generation
    await queueAIResponse({
      conversationId,
      messageId: savedMessage.id,
      userId,
      characterId,
      character,
      message: savedMessage,
      socket
    });
    
    logger.info('Message processed immediately', {
      conversationId,
      messageId: savedMessage.id,
      type: messagePayload.type
    });
    
    return {
      success: true,
      message: savedMessage,
      queuePosition: 0,
      processedImmediately: true
    };
    
  } catch (error) {
    // Reset processing state on error
    await resetConversationProcessing(conversationId);
    throw error;
  }
};

/**
 * Add message to queue for later processing
 * @private
 */
const addMessageToQueueForProcessing = async ({
  conversationId,
  userId,
  characterId,
  messagePayload,
  messageId,
  socket,
  originalTimestamp
}) => {
  try {
    const { addMessageToQueue } = await import('./conversationStateService/index.js');
    
    // Add to queue with preserved timestamp and provided ID
    const queueResult = await addMessageToQueue(conversationId, {
      messageId,
      userId,
      characterId,
      messageData: messagePayload,
      originalTimestamp
    });
    
    // Emit queue status
    const io = getSocketIO();
    io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_QUEUED, {
      messageId,
      queuePosition: queueResult.queuePosition,
      conversationId
    });
    
    io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.QUEUE_STATUS, {
      conversationId,
      queueLength: queueResult.queueLength,
      state: queueResult.state
    });
    
    logger.info('Message added to queue', {
      conversationId,
      messageId,
      queuePosition: queueResult.queuePosition
    });
    
    return {
      success: true,
      messageId,
      queuePosition: queueResult.queuePosition,
      queued: true
    };
    
  } catch (error) {
    logger.error('Error adding message to queue:', error);
    throw error;
  }
};

/**
 * Process next message in queue after AI response completes
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
export const processNextQueuedMessage = async (conversationId) => {
  try {
    logger.debug('Processing next queued message', { conversationId });
    
    // Get next message from queue
    const nextMessage = await getNextQueuedMessage(conversationId);
    
    if (!nextMessage) {
      // No more messages in queue, reset to idle
      await resetConversationProcessing(conversationId);
      
      // Emit queue status
      const io = getSocketIO();
      io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.QUEUE_STATUS, {
        conversationId,
        queueLength: 0,
        state: CONVERSATION_STATES.IDLE
      });
      
      logger.debug('Queue empty, conversation set to idle', { conversationId });
      return;
    }
    
    // Validate character still exists
    const character = await getCharacterById(nextMessage.characterId);
    if (!character) {
      logger.error('Character not found for queued message', {
        conversationId,
        characterId: nextMessage.characterId,
        messageId: nextMessage.messageId
      });
      
      // Remove invalid message and try next
      await removeMessageFromQueue(conversationId, nextMessage.messageId);
      return await processNextQueuedMessage(conversationId);
    }
    
    // Set conversation to processing this message
    await setConversationProcessing(conversationId, nextMessage.messageId);
    
    // Add message to conversation with preserved timestamp (ensure Date object)
    const preservedTimestamp = nextMessage.originalTimestamp instanceof Date 
      ? nextMessage.originalTimestamp 
      : new Date(nextMessage.originalTimestamp);
    
    const savedMessage = await addMessage(conversationId, nextMessage.messageData, preservedTimestamp, nextMessage.messageId);
    
    // Increment Redis usage tracking for rate limiting and display
    try {
      await incrementUsage(nextMessage.userId, nextMessage.characterId, nextMessage.messageData.type);
      logger.debug('Redis usage incremented for queued message', { 
        userId: nextMessage.userId, 
        characterId: nextMessage.characterId, 
        type: nextMessage.messageData.type 
      });
    } catch (usageError) {
      logger.error('Failed to increment Redis usage for queued message (non-blocking):', usageError);
      // Don't fail the queued message processing if Redis usage tracking fails
    }
    
    // Remove from queue
    const queueInfo = await removeMessageFromQueue(conversationId, nextMessage.messageId);
    
    // Emit message to conversation room
    const io = getSocketIO();
    io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_RECEIVE, {
      message: savedMessage,
      conversationId
    });
    
    // Emit processing status
    io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_PROCESSING, {
      messageId: savedMessage.id,
      conversationId,
      processingStartedAt: new Date().toISOString()
    });
    
    // Emit updated queue status
    io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.QUEUE_STATUS, {
      conversationId,
      queueLength: queueInfo.queueLength,
      state: queueInfo.state
    });
    
    // Queue AI response generation
    await queueAIResponse({
      conversationId,
      messageId: savedMessage.id,
      userId: nextMessage.userId,
      characterId: nextMessage.characterId,
      character,
      message: savedMessage
    });
    
    logger.info('Queued message processed', {
      conversationId,
      messageId: savedMessage.id,
      remainingInQueue: queueInfo.queueLength
    });
    
  } catch (error) {
    logger.error('Error processing next queued message:', error);
    
    // Reset processing state on error
    await resetConversationProcessing(conversationId);
    
    // Try next message if available
    setTimeout(() => {
      processNextQueuedMessage(conversationId);
    }, 1000);
  }
};

/**
 * Queue AI response generation
 * @private
 */
const queueAIResponse = async ({
  conversationId,
  messageId,
  userId,
  characterId,
  character,
  message,
  socket
}) => {
  try {
    // Get AI queue from socket server or global
    const aiQueue = socket?.server?.queues?.aiQueue || 
                   global.queues?.aiQueue;
    
    if (!aiQueue) {
      logger.error('AI queue not available', { 
        conversationId, 
        messageId,
        hasSocket: !!socket,
        hasSocketQueues: !!(socket?.server?.queues),
        hasGlobalQueues: !!global.queues,
        globalQueuesKeys: global.queues ? Object.keys(global.queues) : []
      });
      throw new Error('AI queue not available');
    }
    
    logger.debug('AI queue found for processing', {
      conversationId,
      messageId,
      queueSource: socket?.server?.queues?.aiQueue ? 'socket' : 'global'
    });
    
    await queueHelpers.addPriorityJob(
      aiQueue,
      'generate-response',
      {
        conversationId,
        messageId,
        userId,
        characterId,
        character,
        message,
        isQueuedMessage: true // Flag to identify queue-processed messages
      },
      {
        priority: socket?.user?.isPremium ? -1 : 0 // Premium users get priority
      }
    );
    
    logger.debug('AI response queued', {
      conversationId,
      messageId,
      characterId
    });
    
  } catch (error) {
    logger.error('Error queuing AI response:', error);
    throw error;
  }
};

/**
 * Handle AI response completion and trigger next message processing
 * Called from AI response processor after response is sent
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
export const handleAIResponseComplete = async (conversationId) => {
  try {
    logger.debug('AI response completed, checking for next message', { conversationId });
    
    // Small delay to ensure message is fully processed
    setTimeout(async () => {
      await processNextQueuedMessage(conversationId);
    }, 500);
    
  } catch (error) {
    logger.error('Error handling AI response completion:', error);
  }
};

/**
 * Get current queue status for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Queue status
 */
export const getConversationQueueStatus = async (conversationId) => {
  try {
    return await getQueueStatus(conversationId);
  } catch (error) {
    logger.error('Error getting conversation queue status:', error);
    throw error;
  }
};

/**
 * Force process next message (admin/debug function)
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Processing result
 */
export const forceProcessNext = async (conversationId) => {
  try {
    await resetConversationProcessing(conversationId);
    await processNextQueuedMessage(conversationId);
    
    return {
      success: true,
      message: 'Forced processing of next message'
    };
  } catch (error) {
    logger.error('Error force processing next message:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  processUserMessage,
  processNextQueuedMessage,
  handleAIResponseComplete,
  getConversationQueueStatus,
  forceProcessNext
};