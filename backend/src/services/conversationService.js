/**
 * Conversation service
 * Handles conversation and message operations
 * Enhanced with Firebase optimization batching (Phase 1) and smart context caching (Phase 3)
 */
import { getFirebaseFirestore } from '../config/firebase.js';
import { 
  defaultConversation,
  defaultMessage,
  createConversationId,
  validateMessage,
  getConversationSummary,
  calculateConversationStats
} from '../models/Conversation.js';
import { ApiError } from '../middleware/errorHandler.js';
import cache from './cacheService.js';
import { config } from '../config/environment.js';
import logger from '../utils/logger.js';
import messageBatcher, { OperationType } from './messageBatcher.js';
import contextManager from './aiService/contextManager.js';
import writeBehindProcessor, { WriteBehindOperation } from '../queues/writeBehindProcessor.js';

const CONVERSATIONS_COLLECTION = 'conversations';

/**
 * Get or create conversation
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @returns {Promise<Object>} Conversation
 */
export const getOrCreateConversation = async (userId, characterId) => {
  try {
    const conversationId = createConversationId(userId, characterId);
    const cacheKey = cache.keys.conversation(userId, characterId);
    
    return await cache.getOrSet(cacheKey, async () => {
      const firestore = getFirebaseFirestore();
      const conversationRef = firestore.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
      const conversationDoc = await conversationRef.get();
      
      if (conversationDoc.exists) {
        return { id: conversationDoc.id, ...conversationDoc.data() };
      } else {
        // Create new conversation
        const conversation = {
          ...defaultConversation,
          id: conversationId,
          userId,
          characterId,
          startedAt: new Date()
        };
        
        await conversationRef.set(conversation);
        logger.info('New conversation created', { conversationId, userId, characterId });
        
        return conversation;
      }
    }, config.redis.ttl.conversation);
  } catch (error) {
    logger.error('Error getting/creating conversation:', error);
    throw error;
  }
};

/**
 * Get conversation by ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Conversation or null
 */
export const getConversationById = async (conversationId) => {
  try {
    const cacheKey = cache.keys.conversationMeta(conversationId);
    
    return await cache.getOrSet(cacheKey, async () => {
      const firestore = getFirebaseFirestore();
      const conversationDoc = await firestore
        .collection(CONVERSATIONS_COLLECTION)
        .doc(conversationId)
        .get();
      
      if (!conversationDoc.exists) {
        return null;
      }
      
      return { id: conversationDoc.id, ...conversationDoc.data() };
    }, config.redis.ttl.conversation); // Cache for 30 minutes - conversations change frequently with new messages
  } catch (error) {
    logger.error('Error getting conversation:', error);
    throw error;
  }
};

/**
 * Get user conversations
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Conversations list
 */
export const getUserConversations = async (userId, options = {}) => {
  const { limit = 20, offset = 0 } = options;
  
  try {
    // Only cache default query (no pagination)
    if (offset === 0 && limit === 20) {
      const cacheKey = cache.keys.userConversations(userId);
      
      const conversations = await cache.getOrSet(cacheKey, async () => {
        const firestore = getFirebaseFirestore();
        const snapshot = await firestore
          .collection(CONVERSATIONS_COLLECTION)
          .where('userId', '==', userId)
          .where('isActive', '==', true)
          .orderBy('lastMessageAt', 'desc')
          .get();
        
        const convos = [];
        snapshot.forEach(doc => {
          const conversation = { id: doc.id, ...doc.data() };
          convos.push(getConversationSummary(conversation));
        });
        
        return convos;
      }, config.redis.ttl.conversation); // Cache for 30 minutes - conversation lists change with new messages
      
      // Apply pagination
      const paginatedConversations = conversations.slice(offset, offset + limit);
      
      return {
        conversations: paginatedConversations,
        total: conversations.length,
        limit,
        offset,
        hasMore: offset + limit < conversations.length
      };
    }
    
    // For non-default queries, fetch directly
    const firestore = getFirebaseFirestore();
    const snapshot = await firestore
      .collection(CONVERSATIONS_COLLECTION)
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .orderBy('lastMessageAt', 'desc')
      .get();
    
    const conversations = [];
    snapshot.forEach(doc => {
      const conversation = { id: doc.id, ...doc.data() };
      conversations.push(getConversationSummary(conversation));
    });
    
    // Apply pagination
    const paginatedConversations = conversations.slice(offset, offset + limit);
    
    return {
      conversations: paginatedConversations,
      total: conversations.length,
      limit,
      offset,
      hasMore: offset + limit < conversations.length
    };
  } catch (error) {
    logger.error('Error getting user conversations:', error);
    throw error;
  }
};

/**
 * Add message to conversation (Optimized with batching - Phase 1)
 * @param {string} conversationId - Conversation ID
 * @param {Object} messageData - Message data
 * @param {Date} [explicitTimestamp] - Optional explicit timestamp (for preserving original receive time)
 * @param {string} [providedId] - Optional pre-generated message ID (for consistent frontend-backend IDs)
 * @param {boolean} [useBatching=true] - Whether to use batching optimization
 * @returns {Promise<Object>} Added message
 */
export const addMessage = async (conversationId, messageData, explicitTimestamp = null, providedId = null, useBatching = true) => {
  try {
    // Debug logging to track message additions
    logger.debug('addMessage called', {
      conversationId,
      messageType: messageData.type,
      messageSender: messageData.sender,
      messageContent: messageData.content?.substring(0, 50),
      providedId,
      useBatching,
      batchingEnabled: config.redis.batch.enableBatching,
      stackTrace: new Error().stack.split('\n').slice(1, 4).map(line => line.trim())
    });
    
    // Validate message
    const validation = validateMessage(messageData);
    if (!validation.isValid) {
      throw new ApiError(400, `Invalid message: ${validation.errors.join(', ')}`);
    }
    
    // Generate message ID if not provided
    const firestore = getFirebaseFirestore();
    const messageId = providedId || firestore.collection('_').doc().id;
    const message = {
      ...defaultMessage,
      ...messageData,
      id: messageId,
      timestamp: explicitTimestamp || new Date()
    };
    
    // Use batching if enabled and configured
    if (useBatching && config.redis.batch.enableBatching) {
      return await addMessageBatched(conversationId, message);
    } else {
      return await addMessageDirect(conversationId, message);
    }
    
  } catch (error) {
    logger.error('Error adding message:', error);
    throw error;
  }
};

/**
 * Add message using batching system (optimized path)
 * @param {string} conversationId - Conversation ID
 * @param {Object} message - Complete message object
 * @returns {Promise<Object>} Added message
 */
const addMessageBatched = async (conversationId, message) => {
  try {
    // Update conversation in Redis buffer first for immediate consistency
    const bufferKey = cache.keys.conversationBuffer(conversationId);
    const currentBuffer = await cache.get(bufferKey) || { messages: [], updates: {} };
    
    // Add message to buffer
    currentBuffer.messages.push(message);
    currentBuffer.updates = {
      lastMessageAt: new Date(),
      // messageCount should only count user messages for usage tracking
      messageCount: currentBuffer.messages.filter(msg => msg.sender === 'user').length
    };
    
    // Cache the buffered conversation state
    await cache.set(bufferKey, currentBuffer, config.redis.ttl.conversationBuffer);
    
    // Add to batch queue for Firebase write
    const batchOperation = {
      type: OperationType.ADD_MESSAGE,
      target: conversationId,
      data: { message },
      metadata: {
        userId: conversationId.split('_')[0],
        characterId: conversationId.split('_')[1],
        timestamp: Date.now()
      }
    };
    
    const batchSuccess = await messageBatcher.addOperation(batchOperation);
    
    if (!batchSuccess) {
      logger.warn('Batch operation failed, falling back to direct write', { conversationId });
      return await addMessageDirect(conversationId, message);
    }
    
    // Update conversation cache with buffered data
    const [userId, characterId] = conversationId.split('_');
    const conversationCache = await cache.get(cache.keys.conversation(userId, characterId));
    if (conversationCache) {
      conversationCache.messages = [...(conversationCache.messages || []), message];
      conversationCache.lastMessageAt = new Date();
      // messageCount should only count user messages for usage tracking
      conversationCache.messageCount = conversationCache.messages.filter(msg => msg.sender === 'user').length;
      await cache.set(cache.keys.conversation(userId, characterId), conversationCache, config.redis.ttl.conversation);
    }
    
    logger.debug('Message added to batch queue', { 
      conversationId, 
      messageId: message.id, 
      sender: message.sender,
      type: message.type 
    });
    
    // Update context cache incrementally (Phase 3)
    try {
      await contextManager.updateContext(conversationId, message, {
        maxMessages: config.ai?.maxContextMessages || 50, // Use configurable context size
        includeSystemPrompt: true,
        includeTimestamps: false
      });
    } catch (contextError) {
      logger.error('Error updating context cache:', contextError);
    }
    
    return message;
    
  } catch (error) {
    logger.error('Error in batched message add, falling back to direct:', error);
    return await addMessageDirect(conversationId, message);
  }
};

/**
 * Add message directly to Firebase (fallback path)
 * @param {string} conversationId - Conversation ID
 * @param {Object} message - Complete message object
 * @returns {Promise<Object>} Added message
 */
const addMessageDirect = async (conversationId, message) => {
  try {
    const firestore = getFirebaseFirestore();
    const conversationRef = firestore.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
    
    // Get current conversation
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      throw new ApiError(404, 'Conversation not found');
    }
    
    const conversation = conversationDoc.data();
    
    // Update conversation
    const updatedMessages = [...(conversation.messages || []), message];
    const updates = {
      messages: updatedMessages,
      lastMessageAt: new Date(),
      // messageCount should only count user messages for usage tracking
      messageCount: updatedMessages.filter(msg => msg.sender === 'user').length
    };
    
    await conversationRef.update(updates);
    
    // Track direct Firebase write in metrics
    logger.firebaseOp('write', { conversationId, direct: true });
    
    // Invalidate caches (Phase 3: use smart invalidation)
    const [userId, characterId] = conversationId.split('_');
    await cache.del(cache.keys.conversation(userId, characterId));
    await cache.del(cache.keys.conversationMeta(conversationId));
    await cache.del(cache.keys.userConversations(userId));
    
    // Use context manager for smart context invalidation
    await contextManager.invalidateContext(conversationId);
    
    logger.debug('Message added directly to Firebase', { 
      conversationId, 
      messageId: message.id, 
      sender: message.sender,
      type: message.type 
    });
    
    return message;
    
  } catch (error) {
    logger.error('Error in direct message add:', error);
    throw error;
  }
};

/**
 * Get conversation messages
 * @param {string} conversationId - Conversation ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Messages
 */
export const getMessages = async (conversationId, options = {}) => {
  const { limit = 50, before = null } = options;
  
  try {
    const conversation = await getConversationById(conversationId);
    
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    
    let messages = conversation.messages || [];
    
    // Filter messages before timestamp if provided
    if (before) {
      const beforeDate = new Date(before);
      messages = messages.filter(msg => new Date(msg.timestamp) < beforeDate);
    }
    
    // Sort messages by timestamp to ensure chronological order
    // Handle both Firebase Timestamp objects and ISO strings
    const sortedMessages = messages.sort((a, b) => {
      const getTimestamp = (timestamp) => {
        if (!timestamp) return 0;
        
        // Handle Firebase Timestamp object
        if (timestamp._seconds) {
          return timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000;
        }
        
        // Handle ISO string or regular Date
        return new Date(timestamp).getTime();
      };
      
      const timeA = getTimestamp(a.timestamp);
      const timeB = getTimestamp(b.timestamp);

      
      return timeA - timeB;
    });
    
    // Get last N messages
    const paginatedMessages = sortedMessages.slice(-limit);

    
    return {
      messages: paginatedMessages,
      hasMore: paginatedMessages.length < messages.length,
      oldestMessageTimestamp: paginatedMessages[0]?.timestamp || null
    };
  } catch (error) {
    logger.error('Error getting messages:', error);
    throw error;
  }
};

/**
 * Mark messages as read
 * @param {string} conversationId - Conversation ID
 * @param {string[]} messageIds - Message IDs to mark as read
 * @returns {Promise<void>}
 */
export const markMessagesAsRead = async (conversationId, messageIds) => {
  try {
    const firestore = getFirebaseFirestore();
    const conversationRef = firestore.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
    
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      throw new ApiError(404, 'Conversation not found');
    }
    
    const conversation = conversationDoc.data();
    
    // Update read status
    const updatedMessages = (conversation.messages || []).map(msg => {
      if (messageIds.includes(msg.id)) {
        return { ...msg, isRead: true };
      }
      return msg;
    });
    
    await conversationRef.update({ messages: updatedMessages });
    
    // Invalidate caches
    const [userId, characterId] = conversationId.split('_');
    await cache.del(cache.keys.conversation(userId, characterId));
    await cache.del(cache.keys.conversationMeta(conversationId));
    await cache.del(cache.keys.conversationContext(conversationId));
    
    logger.debug('Messages marked as read', { conversationId, count: messageIds.length });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    throw error;
  }
};

/**
 * Mark a user message as answered by AI (Optimized with write-behind - Phase 4)
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID to mark as answered
 * @param {boolean} [useWriteBehind=true] - Whether to use write-behind pattern
 * @returns {Promise<void>}
 */
export const markMessageAsAnswered = async (conversationId, messageId, useWriteBehind = true) => {
  try {
    // Update cache immediately for consistency
    const cacheKey = cache.keys.conversation(conversationId.split('_')[0], conversationId.split('_')[1]);
    const cachedConversation = await cache.get(cacheKey);
    
    if (cachedConversation && cachedConversation.messages) {
      // Update hasAIResponse in cached conversation
      const updatedMessages = cachedConversation.messages.map(msg => {
        if (msg.id === messageId && msg.sender === 'user') {
          return { ...msg, hasAIResponse: true };
        }
        return msg;
      });
      
      cachedConversation.messages = updatedMessages;
      await cache.set(cacheKey, cachedConversation, config.redis.ttl.conversation);
    }
    
    // Use write-behind pattern if enabled
    if (useWriteBehind && config.redis.batch.enableBatching) {
      // Queue the status update for write-behind processing
      const operation = {
        type: WriteBehindOperation.MESSAGE_STATUS,
        collection: CONVERSATIONS_COLLECTION,
        documentId: conversationId,
        data: {
          messageId,
          updates: { hasAIResponse: true }
        },
        priority: 10, // Medium priority for status updates
        dedupeKey: `status:${conversationId}:${messageId}:answered`
      };
      
      const queued = await writeBehindProcessor.queueWriteBehind(operation);
      
      if (!queued) {
        logger.warn('Failed to queue status update, falling back to direct write');
        await markMessageAsAnsweredDirect(conversationId, messageId);
      } else {
        logger.debug('Message status update queued for write-behind', { 
          conversationId, 
          messageId 
        });
      }
    } else {
      // Direct write if write-behind is disabled
      await markMessageAsAnsweredDirect(conversationId, messageId);
    }
    
  } catch (error) {
    logger.error('Error marking message as answered:', error);
    throw error;
  }
};

/**
 * Mark message as answered directly in Firebase (fallback)
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID to mark as answered
 * @returns {Promise<void>}
 */
const markMessageAsAnsweredDirect = async (conversationId, messageId) => {
  try {
    const firestore = getFirebaseFirestore();
    const conversationRef = firestore.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
    
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      logger.error('Conversation not found for marking answered', { conversationId });
      throw new ApiError(404, 'Conversation not found');
    }
    
    const conversation = conversationDoc.data();
    
    // Update the specific message's hasAIResponse field
    const updatedMessages = (conversation.messages || []).map(msg => {
      if (msg.id === messageId && msg.sender === 'user') {
        return { ...msg, hasAIResponse: true };
      }
      return msg;
    });
    
    await conversationRef.update({ messages: updatedMessages });
    
    // Invalidate caches
    const [userId, characterId] = conversationId.split('_');
    await cache.del(cache.keys.conversation(userId, characterId));
    await cache.del(cache.keys.conversationMeta(conversationId));
    await contextManager.invalidateContext(conversationId);
    
    logger.debug('Message marked as answered directly', { conversationId, messageId });
  } catch (error) {
    logger.error('Error in direct mark as answered:', error);
    throw error;
  }
};

/**
 * Update message with additional data (e.g., LLM error state)
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID to update
 * @param {Object} updateData - Data to merge into the message
 * @returns {Promise<Object>} Updated message
 */
export const updateMessage = async (conversationId, messageId, updateData) => {
  try {
    const firestore = getFirebaseFirestore();
    const conversationRef = firestore.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
    
    // Get current conversation
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      throw new ApiError(404, 'Conversation not found');
    }
    
    const conversation = conversationDoc.data();
    const messages = conversation.messages || [];
    
    // Find and update the message
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      throw new ApiError(404, 'Message not found');
    }
    
    // Update the message with new data
    const updatedMessage = {
      ...messages[messageIndex],
      ...updateData,
      updatedAt: new Date()
    };
    
    // Update the messages array
    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = updatedMessage;
    
    // Update conversation in database
    await conversationRef.update({
      messages: updatedMessages
    });
    
    // Invalidate caches
    const [userId, characterId] = conversationId.split('_');
    await cache.del(cache.keys.conversation(userId, characterId));
    await cache.del(cache.keys.conversationMeta(conversationId));
    await cache.del(cache.keys.conversationContext(conversationId));
    
    logger.debug('Message updated', { 
      conversationId, 
      messageId,
      updateData: Object.keys(updateData)
    });
    
    return updatedMessage;
  } catch (error) {
    logger.error('Error updating message:', error);
    throw error;
  }
};

/**
 * Delete conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
export const deleteConversation = async (conversationId) => {
  try {
    const firestore = getFirebaseFirestore();
    
    await firestore.collection(CONVERSATIONS_COLLECTION).doc(conversationId).update({
      isActive: false,
      deletedAt: new Date()
    });
    
    // Invalidate caches
    const [userId, characterId] = conversationId.split('_');
    await cache.del(cache.keys.conversation(userId, characterId));
    await cache.del(cache.keys.conversationMeta(conversationId));
    await cache.del(cache.keys.conversationContext(conversationId));
    await cache.del(cache.keys.userConversations(userId));
    
    logger.info('Conversation deleted', { conversationId });
  } catch (error) {
    logger.error('Error deleting conversation:', error);
    throw error;
  }
};

/**
 * Get conversation statistics
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Statistics
 */
export const getConversationStats = async (conversationId) => {
  try {
    const conversation = await getConversationById(conversationId);
    
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    
    return calculateConversationStats(conversation);
  } catch (error) {
    logger.error('Error getting conversation stats:', error);
    throw error;
  }
};

/**
 * Search messages in conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} query - Search query
 * @returns {Promise<Object[]>} Matching messages
 */
export const searchMessages = async (conversationId, query) => {
  try {
    const conversation = await getConversationById(conversationId);
    
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    
    const messages = conversation.messages || [];
    const queryLower = query.toLowerCase();
    
    // Search in text messages
    const matchingMessages = messages.filter(msg => {
      if (msg.type === 'text' && msg.content) {
        return msg.content.toLowerCase().includes(queryLower);
      }
      if (msg.type === 'media' && msg.mediaData?.caption) {
        return msg.mediaData.caption.toLowerCase().includes(queryLower);
      }
      return false;
    });
    
    return matchingMessages;
  } catch (error) {
    logger.error('Error searching messages:', error);
    throw error;
  }
};

/**
 * Get conversation from buffer or cache (Phase 3 optimization)
 * Checks Redis buffer first, then falls back to Firebase
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Conversation data
 */
const getConversationFromBuffer = async (conversationId) => {
  try {
    // First check Redis buffer (from Phase 1)
    const bufferKey = cache.keys.conversationBuffer(conversationId);
    const bufferedData = await cache.get(bufferKey);
    
    if (bufferedData && bufferedData.messages) {
      // Merge buffered messages with cached conversation
      const baseConversation = await getConversationById(conversationId);
      if (baseConversation) {
        return {
          ...baseConversation,
          messages: [...(baseConversation.messages || []), ...bufferedData.messages],
          ...bufferedData.updates
        };
      }
    }
    
    // Fall back to regular get
    return await getConversationById(conversationId);
    
  } catch (error) {
    logger.error('Error getting conversation from buffer:', error);
    return await getConversationById(conversationId);
  }
};

/**
 * Get last message between user and character
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @returns {Promise<Object|null>} Last message or null
 */
export const getLastMessage = async (userId, characterId) => {
  try {
    const conversationId = createConversationId(userId, characterId);
    const conversation = await getConversationById(conversationId);
    
    if (!conversation || !conversation.messages || conversation.messages.length === 0) {
      return null;
    }
    
    return conversation.messages[conversation.messages.length - 1];
  } catch (error) {
    logger.error('Error getting last message:', error);
    return null;
  }
};

/**
 * Get conversation context for AI generation (Optimized with smart caching - Phase 3)
 * @param {string} conversationId - Conversation ID
 * @param {Object} options - Context options
 * @returns {Promise<Object>} Conversation context
 */
export const getConversationContext = async (conversationId, options = {}) => {
  const { 
    maxMessages = config.ai?.maxContextMessages || 50, // Use configurable default
    includeSystemPrompt = true,
    includeTimestamps = false 
  } = options;
  
  try {
    // Use the enhanced context manager for multi-layer caching
    return await contextManager.getContext(
      conversationId,
      async () => {
        // This fetch function is only called on cache miss
        const conversation = await getConversationFromBuffer(conversationId);
        
        if (!conversation) {
          throw new ApiError(404, 'Conversation not found');
        }
        
        // Get recent messages with proper chronological sorting
        const allMessages = conversation.messages || [];
        
        // Sort by timestamp to ensure chronological order
        const sortedMessages = allMessages.sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        // DEBUG: Log conversation context retrieval
        logger.debug('🔍 CONVERSATION CONTEXT - message retrieval', {
          conversationId,
          totalMessagesInConversation: allMessages.length,
          maxMessages,
          sortedMessagesCount: sortedMessages.length,
          allMessagesSummary: allMessages.map(m => ({
            id: m.id,
            sender: m.sender,
            timestamp: m.timestamp,
            content: m.content?.substring(0, 30),
            hasLLMError: m.hasLLMError
          })),
          sortedMessagesSummary: sortedMessages.map(m => ({
            id: m.id,
            sender: m.sender,
            timestamp: m.timestamp,
            content: m.content?.substring(0, 30),
            hasLLMError: m.hasLLMError
          }))
        });
        
        // Take recent messages after sorting - preserve ALL fields for AI processing
        const messages = sortedMessages
          .slice(-maxMessages)
          .map(msg => {
            // Return the complete message object to preserve all fields including:
            // id, hasLLMError, errorType, audioData, mediaData, etc.
            return { ...msg };
          });
          
        // DEBUG: Log final context messages being passed to AI
        logger.debug('🔍 CONVERSATION CONTEXT - final context', {
          conversationId,
          contextMessagesCount: messages.length,
          contextMessages: messages.map(m => ({
            id: m.id,
            sender: m.sender,
            timestamp: m.timestamp,
            content: m.content?.substring(0, 30),
            hasLLMError: m.hasLLMError
          }))
        });
        
        return {
          conversationId,
          userId: conversation.userId,
          characterId: conversation.characterId,
          messages,
          messageCount: conversation.messages?.length || 0,
          startedAt: conversation.startedAt,
          lastMessageAt: conversation.lastMessageAt
        };
      },
      options
    );
  } catch (error) {
    logger.error('Error getting conversation context:', error);
    throw error;
  }
};

/**
 * Get user message usage across all conversations
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Usage data per character
 */
export const getUserUsage = async (userId) => {
  try {
    const firestore = getFirebaseFirestore();
    
    // Get all conversations for this user
    const conversationsQuery = firestore
      .collection(CONVERSATIONS_COLLECTION)
      .where('userId', '==', userId);
    
    const conversationsSnapshot = await conversationsQuery.get();
    const usage = {};
    
    conversationsSnapshot.forEach(doc => {
      const conversation = doc.data();
      const characterId = conversation.characterId;
      
      if (!usage[characterId]) {
        usage[characterId] = {
          text: 0,
          audio: 0,
          image: 0
        };
      }
      
      // Count user messages by type
      const messages = conversation.messages || [];
      const userMessages = messages.filter(msg => msg.sender === 'user');
      
      userMessages.forEach(msg => {
        const type = msg.type || 'text';
        if (usage[characterId][type] !== undefined) {
          usage[characterId][type]++;
        }
      });
    });
    
    return usage;
  } catch (error) {
    logger.error('Error getting user usage:', error);
    throw error;
  }
};

/**
 * Check if user can send message based on conversation usage
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @param {string} messageType - Message type (text, audio, image)
 * @param {boolean} isPremium - User premium status
 * @returns {Promise<Object>} Can send result
 */
export const canSendMessage = async (userId, characterId, messageType, isPremium) => {
  try {
    // Premium users have unlimited messages
    if (isPremium) {
      return { 
        canSend: true, 
        reason: 'premium'
      };
    }
    
    // Get current usage for this character
    const allUsage = await getUserUsage(userId);
    const characterUsage = allUsage[characterId] || { text: 0, audio: 0, image: 0 };
    
    // Define limits for free tier
    const limits = {
      text: 30,
      audio: 5,
      image: 5
    };
    
    const used = characterUsage[messageType] || 0;
    const limit = limits[messageType] || 0;
    
    if (used >= limit) {
      return { 
        canSend: false, 
        reason: 'limit_reached',
        limit,
        used,
        remaining: 0
      };
    }
    
    return { 
      canSend: true, 
      reason: 'within_limit',
      limit,
      used,
      remaining: limit - used
    };
  } catch (error) {
    logger.error('Error checking message permission:', error);
    throw error;
  }
};

/**
 * Like or unlike a message (Optimized with write-behind - Phase 4)
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID who is liking
 * @param {boolean} isLiked - Whether to like (true) or unlike (false)
 * @param {boolean} [useWriteBehind=true] - Whether to use write-behind pattern
 * @returns {Promise<void>}
 */
export const likeMessage = async (conversationId, messageId, userId, isLiked, useWriteBehind = true) => {
  try {
    // Update cache immediately for instant feedback
    const cacheKey = cache.keys.conversation(conversationId.split('_')[0], conversationId.split('_')[1]);
    const cachedConversation = await cache.get(cacheKey);
    
    if (cachedConversation && cachedConversation.messages) {
      // Update likes in cached conversation
      const updatedMessages = cachedConversation.messages.map(msg => {
        if (msg.id === messageId) {
          if (!msg.likes) msg.likes = {};
          
          if (isLiked) {
            msg.likes[userId] = true;
          } else {
            delete msg.likes[userId];
          }
        }
        return msg;
      });
      
      cachedConversation.messages = updatedMessages;
      await cache.set(cacheKey, cachedConversation, config.redis.ttl.conversation);
    }
    
    // Use write-behind pattern if enabled
    if (useWriteBehind && config.redis.batch.enableBatching) {
      // Queue the like operation for write-behind processing
      const operation = {
        type: isLiked ? WriteBehindOperation.MESSAGE_LIKE : WriteBehindOperation.MESSAGE_UNLIKE,
        collection: CONVERSATIONS_COLLECTION,
        documentId: conversationId,
        data: {
          messageId,
          userId
        },
        priority: 5, // Low priority for likes
        dedupeKey: `like:${conversationId}:${messageId}:${userId}`
      };
      
      const queued = await writeBehindProcessor.queueWriteBehind(operation);
      
      if (!queued) {
        logger.warn('Failed to queue like operation, falling back to direct write');
        await likeMessageDirect(conversationId, messageId, userId, isLiked);
      } else {
        logger.debug('Message like queued for write-behind', { 
          conversationId, 
          messageId, 
          userId, 
          isLiked 
        });
      }
    } else {
      // Direct write if write-behind is disabled
      await likeMessageDirect(conversationId, messageId, userId, isLiked);
    }
    
  } catch (error) {
    logger.error('Error liking message:', error);
    throw error;
  }
};

/**
 * Like message directly in Firebase (fallback)
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID who is liking
 * @param {boolean} isLiked - Whether to like (true) or unlike (false)
 * @returns {Promise<void>}
 */
const likeMessageDirect = async (conversationId, messageId, userId, isLiked) => {
  try {
    const firestore = getFirebaseFirestore();
    const conversationRef = firestore.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
    
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      throw new ApiError(404, 'Conversation not found');
    }
    
    const conversation = conversationDoc.data();
    const messages = conversation.messages || [];
    
    // Find and update the message
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        // Initialize likes object if it doesn't exist
        if (!msg.likes) {
          msg.likes = {};
        }
        
        // Update like status for this user
        if (isLiked) {
          msg.likes[userId] = true;
        } else {
          delete msg.likes[userId];
        }
        
        return msg;
      }
      return msg;
    });
    
    // Check if message was found
    const messageFound = messages.some(msg => msg.id === messageId);
    if (!messageFound) {
      throw new ApiError(404, 'Message not found');
    }
    
    // Update conversation with modified messages
    await conversationRef.update({ 
      messages: updatedMessages,
      lastMessageAt: new Date()
    });
    
    // Invalidate caches
    const [cacheUserId, characterId] = conversationId.split('_');
    await cache.del(cache.keys.conversation(cacheUserId, characterId));
    await cache.del(cache.keys.conversationMeta(conversationId));
    await contextManager.invalidateContext(conversationId);
    
    logger.debug('Message like updated directly', { 
      conversationId, 
      messageId, 
      userId, 
      isLiked 
    });
  } catch (error) {
    logger.error('Error in direct message like:', error);
    throw error;
  }
};

/**
 * Get a specific message by ID from a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID
 * @returns {Promise<Object|null>} Message or null if not found
 */
export const getMessage = async (conversationId, messageId) => {
  try {
    const conversation = await getConversationById(conversationId);
    if (!conversation || !conversation.messages) {
      return null;
    }
    
    return conversation.messages.find(msg => msg.id === messageId) || null;
  } catch (error) {
    logger.error('Error getting message:', error);
    throw error;
  }
};

/**
 * Clear error fields from message after successful retry
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID to clear errors from
 * @returns {Promise<Object|null>} Updated message or null if no errors to clear
 */
export const clearSuccessfulRetryErrors = async (conversationId, messageId) => {
  try {
    
    // Get the current message to check if it has error fields
    const message = await getMessage(conversationId, messageId);
    
    if (!message) {
      console.log('🧹 CLEAR_ERRORS: Message not found, returning null');
      logger.debug('Message not found for error clearing', { conversationId, messageId });
      return null;
    }
    
    // Only clear if message actually has LLM error fields
    if (!message.hasLLMError && !message.isRetrying) {
      console.log('🧹 CLEAR_ERRORS: No LLM errors to clear, returning null');
      logger.debug('Message has no LLM errors to clear', { conversationId, messageId });
      return null;
    }

    
    // Clear all error and retry fields
    const updateData = {
      hasLLMError: undefined,
      errorType: undefined,
      errorTimestamp: undefined,
      originalError: undefined,
      isRetrying: undefined,
      retryAttempt: undefined,
      // Keep retryCount for analytics
      // retryCount: (unchanged)
      clearedAt: Date.now() // Track when errors were cleared
    };

    const updatedMessage = await updateMessage(conversationId, messageId, updateData);

    
    return updatedMessage;
  } catch (error) {
    throw error;
  }
};

/**
 * Mark message as being retried (keeps error fields for token filtering)
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID to mark as retrying
 * @returns {Promise<Object>} Updated message
 */
export const markMessageRetrying = async (conversationId, messageId) => {
  try {
    logger.debug('Setting retry state for LLM error message (keeping error fields for token filtering)', { conversationId, messageId });
    
    // Keep LLM error flags for token filtering, but add retry tracking
    const updatedMessage = await updateMessage(conversationId, messageId, {
      // Keep these fields so message continues to be filtered from AI context (token savings)
      // hasLLMError: true (unchanged)
      // errorType: 'provider_error' (unchanged) 
      // originalError: error details (unchanged)
      isRetrying: true, // Mark as being retried
      retryAttempt: Date.now(), // Track when retry was initiated
      retryCount: (await getMessage(conversationId, messageId))?.retryCount + 1 || 1
    });

    
    return updatedMessage;
  } catch (error) {
    throw error;
  }
};

/**
 * Retry a failed message by clearing error state and re-queueing for processing
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID to retry
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @returns {Promise<Object>} Retry result
 */
export const retryMessage = async (conversationId, messageId, userId, characterId) => {
  try {
    logger.info('Initiating message retry', { 
      conversationId, 
      messageId, 
      userId, 
      characterId 
    });
    
    // Get the current message to verify it has an error
    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    
    const message = conversation.messages?.find(msg => msg.id === messageId);
    if (!message) {
      throw new ApiError(404, 'Message not found');
    }
    
    if (!message.hasLLMError) {
      throw new ApiError(400, 'Message does not have an LLM error to retry');
    }
    
    // Mark message as retrying (keeps error fields for token filtering)
    const clearedMessage = await markMessageRetrying(conversationId, messageId);
    
    logger.debug('Message marked for retry (error fields preserved), preparing for retry', {
      messageId,
      originalContent: message.content?.substring(0, 50)
    });
    
    return {
      success: true,
      messageId,
      conversationId,
      clearedAt: clearedMessage.retryAttempt,
      message: message // Return the complete message object from Firebase
    };
  } catch (error) {
    logger.error('Error retrying message:', {
      conversationId,
      messageId,
      userId,
      characterId,
      error: error.message
    });
    throw error;
  }
};

export default {
  getOrCreateConversation,
  getConversationById,
  getUserConversations,
  addMessage,
  updateMessage,
  getMessages,
  getMessage,
  markMessagesAsRead,
  deleteConversation,
  getConversationStats,
  searchMessages,
  getLastMessage,
  getConversationContext,
  getUserUsage,
  canSendMessage,
  likeMessage,
  clearSuccessfulRetryErrors,
  markMessageRetrying,
  retryMessage
}; 