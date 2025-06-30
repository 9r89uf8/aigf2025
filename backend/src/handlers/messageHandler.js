/**
 * Socket.io message handlers
 * Handles real-time message events with natural message queuing
 * 
 * References: NATURAL_MESSAGE_QUEUING_PLAN.md - Phase 1
 */
import { getSocketIO, SOCKET_EVENTS, emitToConversation } from '../config/socket.js';
import { socketRateLimit, socketEventRateLimit, logSocketEvent } from '../middleware/socketAuth.js';
import { 
  getOrCreateConversation, 
  addMessage, 
  markMessagesAsRead,
  canSendMessage,
  retryMessage
} from '../services/conversationService.js';
import { getCharacterById } from '../services/characterService.js';
import { processUserMessage } from '../services/messageQueueProcessor.js';
import { queueHelpers } from '../config/queues.js';
import { validateMessage } from '../models/Conversation.js';
import logger from '../utils/logger.js';

/**
 * Register message handlers on socket
 * @param {Socket} socket - Socket.io socket instance
 */
export const registerMessageHandlers = (socket) => {
  /**
   * Handle sending a message with natural queuing system
   */
  socket.on(SOCKET_EVENTS.MESSAGE_SEND, 
    socketEventRateLimit(20, 60000)(async (data, callback) => {
      // Log the socket event
      logger.debug('Socket event: message:send with queuing', {
        userId: socket.userId,
        socketId: socket.id,
        characterId: data.characterId,
        messageId: data.messageId
      });
      
      try {
        // Ensure conversation exists first
        if (data.characterId) {
          await getOrCreateConversation(socket.userId, data.characterId);
        }
        
        // Capture original timestamp when message is received via WebSocket
        const originalTimestamp = new Date();
        
        // Process message through queue system with original timestamp
        const result = await processUserMessage(data, socket, originalTimestamp);
        
        // Update character stats if message was successfully processed
        if (result.success && result.message) {
          const character = await getCharacterById(data.characterId);
          if (character) {
            const conversationId = `${socket.userId}_${data.characterId}`;
            const conversation = await getOrCreateConversation(socket.userId, data.characterId);
            
            if (conversation.messages.length === 1) {
              // First message in conversation
              await updateCharacterStats(data.characterId, {
                totalConversations: character.stats.totalConversations + 1,
                totalMessages: character.stats.totalMessages + 1,
                lastActiveAt: new Date()
              });
            } else {
              await updateCharacterStats(data.characterId, {
                totalMessages: character.stats.totalMessages + 1,
                lastActiveAt: new Date()
              });
            }
          }
        }
        
        // Log the result
        if (result.success) {
          logger.info('Message processed via queue system', {
            userId: socket.userId,
            characterId: data.characterId,
            messageId: result.message?.id || result.messageId,
            type: data.type || 'text',
            processedImmediately: result.processedImmediately,
            queued: result.queued,
            queuePosition: result.queuePosition
          });
        }
        
        callback(result);
        
      } catch (error) {
        logger.error('Error handling message send with queuing:', error);
        callback({ 
          success: false, 
          error: 'Failed to send message' 
        });
      }
    })
  );
  
  /**
   * Handle marking messages as read
   */
  socket.on(SOCKET_EVENTS.MESSAGE_READ,
    async (data, callback) => {
      // Log the socket event
      logger.debug('Socket event: message:read', {
        userId: socket.userId,
        socketId: socket.id,
        characterId: socket.characterId
      });
      try {
        const { conversationId, messageIds } = data;
        
        if (!conversationId || !messageIds || !Array.isArray(messageIds)) {
          return callback({ 
            success: false, 
            error: 'Invalid parameters' 
          });
        }
        
        // Verify user owns the conversation
        const [userId, characterId] = conversationId.split('_');
        if (userId !== socket.userId) {
          return callback({ 
            success: false, 
            error: 'Unauthorized' 
          });
        }
        
        // Mark messages as read
        await markMessagesAsRead(conversationId, messageIds);
        
        // Notify other devices
        emitToConversation(userId, characterId, SOCKET_EVENTS.MESSAGE_STATUS, {
          conversationId,
          messageIds,
          status: 'read'
        });
        
        callback({ success: true });
        
      } catch (error) {
        logger.error('Error marking messages as read:', error);
        callback({ 
          success: false, 
          error: 'Failed to mark messages as read' 
        });
      }
    }
  );
  
  /**
   * Handle typing indicators
   */
  socket.on(SOCKET_EVENTS.TYPING_START,
    socketEventRateLimit(10, 10000)(async (data) => {
      // Log the socket event
      logger.debug('Socket event: typing:start', {
        userId: socket.userId,
        socketId: socket.id,
        characterId: socket.characterId
      });
      try {
        const { characterId } = data;
        
        if (!characterId) return;
        
        // Broadcast to conversation room except sender
        socket.to(`conversation:${socket.userId}_${characterId}`).emit(
          SOCKET_EVENTS.TYPING_START,
          {
            userId: socket.userId,
            characterId,
            timestamp: new Date()
          }
        );
        
      } catch (error) {
        logger.error('Error handling typing start:', error);
      }
    })
  );
  
  socket.on(SOCKET_EVENTS.TYPING_STOP,
    socketEventRateLimit(10, 10000)(async (data) => {
      // Log the socket event
      logger.debug('Socket event: typing:stop', {
        userId: socket.userId,
        socketId: socket.id,
        characterId: socket.characterId
      });
      try {
        const { characterId } = data;
        
        if (!characterId) return;
        
        // Broadcast to conversation room except sender
        socket.to(`conversation:${socket.userId}_${characterId}`).emit(
          SOCKET_EVENTS.TYPING_STOP,
          {
            userId: socket.userId,
            characterId,
            timestamp: new Date()
          }
        );
        
      } catch (error) {
        logger.error('Error handling typing stop:', error);
      }
    })
  );
  
  /**
   * Handle message retry for LLM error messages
   */
  socket.on(SOCKET_EVENTS.MESSAGE_RETRY,
    socketEventRateLimit(5, 60000)(async (data, callback) => {
      // Log the socket event
      logger.debug('Socket event: message:retry', {
        userId: socket.userId,
        socketId: socket.id,
        messageId: data.messageId,
        conversationId: data.conversationId
      });
      
      try {
        console.log('🔄 RETRY HANDLER: Starting retry process:', {
          userId: socket.userId,
          socketId: socket.id,
          data,
          hasCallback: typeof callback === 'function'
        });
        
        const { conversationId, messageId, characterId } = data;
        
        if (!conversationId || !messageId || !characterId) {
          console.log('🚫 RETRY HANDLER: Missing parameters:', { conversationId, messageId, characterId });
          return callback({ 
            success: false, 
            error: 'Missing required parameters' 
          });
        }
        
        console.log('🔄 RETRY HANDLER: Parameters validated successfully');
        
        // Verify user owns the conversation
        const [userId, convCharacterId] = conversationId.split('_');
        if (userId !== socket.userId || convCharacterId !== characterId) {
          return callback({ 
            success: false, 
            error: 'Unauthorized' 
          });
        }
        
        // Clear error state and prepare for retry
        const retryResult = await retryMessage(conversationId, messageId, socket.userId, characterId);
        
        // Check retry limit (max 3 retries per message)
        const MAX_RETRIES = 3;
        if (retryResult.message.retryCount && retryResult.message.retryCount >= MAX_RETRIES) {
          console.log(`🚫 RETRY: Max retry limit reached (${retryResult.message.retryCount}/${MAX_RETRIES})`);
          return callback({ 
            success: false, 
            error: `Maximum retry limit reached (${MAX_RETRIES} retries)`,
            retryLimitReached: true,
            retryCount: retryResult.message.retryCount,
            maxRetries: MAX_RETRIES
          });
        }
        
        console.log(`🔄 RETRY: Proceeding with retry ${retryResult.message.retryCount || 1}/${MAX_RETRIES}`);
        
        // Notify the conversation room that the message is being retried
        emitToConversation(socket.userId, characterId, SOCKET_EVENTS.MESSAGE_STATUS, {
          conversationId,
          messageId,
          status: 'retrying',
          timestamp: retryResult.clearedAt
        });
        
        // Get character data for AI job
        const character = await getCharacterById(characterId);
        if (!character) {
          throw new Error('Character not found');
        }
        
        // Import AI service directly to bypass all queue systems
        const { generateAIResponse } = await import('../services/aiService/index.js');
        
        // Add debug log to confirm we're using direct AI call
        console.log('🚀 RETRY: Using direct AI service call (no queue)');
        logger.debug('Retry using direct AI service call', { conversationId, messageId });
        
        // Generate AI response directly without any queue processing
        // This completely bypasses message creation and queue systems
        const aiResponse = await generateAIResponse({
          conversationId,
          userId: socket.userId,
          characterId,
          message: retryResult.message,
          responseType: 'text' // Default to text for retry
        });
        
        // Use the standard AI response handler to ensure all logic is applied (including error clearing)
        console.log('🔄 RETRY: Using handleAIResponse to process retry response');
        await handleAIResponse({
          conversationId,
          userId: socket.userId,
          characterId,
          response: aiResponse.content,
          responseType: aiResponse.type || 'text',
          audioUrl: aiResponse.audioUrl,
          mediaItem: aiResponse.mediaItem,
          aiMetadata: aiResponse.aiMetadata,
          replyToMessageId: messageId // Link to original user message for error clearing
        });
        
        console.log('✅ RETRY: AI response processed through handleAIResponse (includes error clearing)');
        
        // Log successful retry completion
        logger.info('Message retry completed directly (no queue)', {
          userId: socket.userId,
          conversationId,
          messageId,
          characterId,
          responseType: aiResponse.type,
          directAICall: true
        });
        
        callback({
          success: true,
          messageId,
          conversationId,
          retryCompleted: true,
          responseType: aiResponse.type,
          directAICall: true,
          message: 'Message retry completed successfully'
        });
        
      } catch (error) {
        console.log('🚫 RETRY ERROR: Caught exception in retry handler:', {
          error: error.message,
          stack: error.stack,
          userId: socket.userId,
          messageId: data.messageId,
          conversationId: data.conversationId,
          fullError: error,
          isLLMError: error.isLLMError,
          errorType: error.errorType
        });
        
        // Check if this is an LLM error (AI service failure during retry)
        if (error && error.isLLMError === true) {
          console.log('🚫 RETRY ERROR: LLM service failed during retry, updating message error state');
          
          // Update the message to reflect the new LLM error (preserve retry count)
          try {
            const { updateMessage, getMessage } = await import('../services/conversationService.js');
            
            // Get current message to preserve retry count
            const currentMessage = await getMessage(data.conversationId, data.messageId);
            console.log('🔄 RETRY ERROR: Current message before error update:', {
              messageId: data.messageId,
              currentRetryCount: currentMessage?.retryCount,
              hasRetryCount: 'retryCount' in (currentMessage || {})
            });
            
            await updateMessage(data.conversationId, data.messageId, {
              hasLLMError: true,
              errorType: error.errorType || 'retry_llm_failure',
              errorTimestamp: error.timestamp || Date.now(),
              originalError: error.originalError || error.qualityControl?.error || 'LLM service failed during retry',
              retryFailed: true,
              lastRetryAt: Date.now(),
              // Preserve the retry count that was incremented by markMessageRetrying()
              retryCount: currentMessage?.retryCount || 1
            });
            
            console.log('🔄 RETRY ERROR: Updated message with preserved retry count:', {
              messageId: data.messageId,
              preservedRetryCount: currentMessage?.retryCount || 1
            });
            
            // Emit LLM error event to frontend
            const io = getSocketIO();
            if (io) {
              io.to(`conversation:${data.conversationId}`).emit('message:llm_error', {
                conversationId: data.conversationId,
                messageId: data.messageId,
                errorType: error.errorType || 'retry_llm_failure',
                isLLMError: true,
                timestamp: error.timestamp || Date.now(),
                retryFailed: true
              });
            }
            
            logger.warn('Retry failed due to LLM service error', {
              userId: socket.userId,
              messageId: data.messageId,
              conversationId: data.conversationId,
              errorType: error.errorType,
              provider: error.provider
            });
            
            callback({ 
              success: false, 
              error: 'AI service is currently unavailable. Please try again later.',
              isLLMError: true,
              retryFailed: true,
              retryCount: currentMessage?.retryCount || 1,
              messageId: data.messageId
            });
            
          } catch (updateError) {
            console.log('🚫 RETRY ERROR: Failed to update message error state:', updateError);
            callback({ 
              success: false, 
              error: 'AI service is currently unavailable. Please try again later.' 
            });
          }
        } else {
          // Handle regular errors
          logger.error('Error handling message retry:', {
            error: error.message,
            stack: error.stack,
            userId: socket.userId,
            messageId: data.messageId,
            conversationId: data.conversationId
          });
          
          callback({ 
            success: false, 
            error: error.message || 'Failed to retry message' 
          });
        }
      }
    })
  );
};


/**
 * Handle AI response completion and emit to clients
 * Called from AI response processor after response is generated
 * @param {Object} data - Response data
 */
export const handleAIResponse = async (data) => {
  try {
    const { 
      conversationId, 
      userId, 
      characterId, 
      response, 
      responseType,
      audioUrl,
      mediaItem,
      aiMetadata,
      replyToMessageId 
    } = data;
    
    // Create AI message with reply tracking
    const aiMessage = {
      sender: 'character',
      type: responseType || 'text',
      content: responseType === 'text' ? response : null,
      audioData: responseType === 'audio' ? {
        url: audioUrl,
        duration: aiMetadata.audioDuration || 0,
        format: 'mp3',
        size: 0
      } : null,
      mediaData: responseType === 'media' ? {
        url: mediaItem.url,
        type: mediaItem.type,
        thumbnailUrl: mediaItem.thumbnailUrl,
        caption: mediaItem.caption,
        width: mediaItem.width,
        height: mediaItem.height,
        size: mediaItem.size
      } : null,
      aiMetadata,
      replyToMessageId // Link to original user message
    };
    
    logger.debug('Saving AI response to Firebase', {
      conversationId,
      aiMessageType: aiMessage.type,
      replyToMessageId,
      sender: aiMessage.sender,
      isAIResponse: true
    });
    
    // Add to conversation (this saves the AI response, not user message)
    const savedMessage = await addMessage(conversationId, aiMessage);
    
    // Mark the original user message as answered if replyToMessageId exists
    if (replyToMessageId) {
      try {
        console.log('🎯 AI_RESPONSE: Processing AI response with replyToMessageId', {
          conversationId,
          replyToMessageId,
          aiResponseId: savedMessage.id
        });
        
        const { markMessageAsAnswered, clearSuccessfulRetryErrors } = await import('../services/conversationService.js');
        
        // Mark as answered
        console.log('🎯 AI_RESPONSE: Marking message as answered');
        await markMessageAsAnswered(conversationId, replyToMessageId);
        
        // Clear error fields if this was a successful retry of a failed message
        console.log('🎯 AI_RESPONSE: Calling clearSuccessfulRetryErrors');
        const clearResult = await clearSuccessfulRetryErrors(conversationId, replyToMessageId);
        console.log('🎯 AI_RESPONSE: Clear result:', clearResult);
        
        logger.debug('Marked user message as answered and cleared retry errors if present', {
          conversationId,
          userMessageId: replyToMessageId,
          aiResponseId: savedMessage.id
        });
      } catch (markError) {
        console.log('🎯 AI_RESPONSE: Error in marking/clearing:', markError);
        logger.error('Failed to mark user message as answered or clear retry errors:', markError);
        // Don't fail the whole response if this fails
      }
    }
    
    // Emit to conversation room
    const io = getSocketIO();
    io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_RECEIVE, {
      message: savedMessage,
      conversationId
    });
    
    // Emit response linked event for UI to show relationships
    if (replyToMessageId) {
      io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_RESPONSE_LINKED, {
        responseMessageId: savedMessage.id,
        originalMessageId: replyToMessageId,
        conversationId
      });
    }
    
    // Track response for analytics
    logger.debug('AI response tracked with reply link', {
      characterId,
      userId,
      responseType,
      messageId: savedMessage.id,
      conversationId,
      replyToMessageId,
      isAIResponse: true
    });
    
    logger.info('AI response sent with reply tracking', {
      conversationId,
      messageId: savedMessage.id,
      responseType,
      replyToMessageId
    });
    
  } catch (error) {
    logger.error('Error handling AI response:', error);
    
    // Notify user of error
    const io = getSocketIO();
    io.to(`conversation:${data.conversationId}`).emit(SOCKET_EVENTS.MESSAGE_STATUS, {
      conversationId: data.conversationId,
      status: 'error',
      error: 'Failed to generate response'
    });
  }
};

/**
 * Update character stats (internal use)
 */
const updateCharacterStats = async (characterId, updates) => {
  try {
    const { updateCharacterStats } = await import('../services/characterService.js');
    await updateCharacterStats(characterId, updates);
  } catch (error) {
    logger.error('Failed to update character stats:', error);
  }
};

export default {
  registerMessageHandlers,
  handleAIResponse
}; 