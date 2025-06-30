/**
 * Socket.io conversation handlers
 * this sits at the backend
 * Handles conversation-related events
 */
import { SOCKET_EVENTS, emitToUser } from '../config/socket.js';
import { logSocketEvent } from '../middleware/socketAuth.js';
import { 
  getUserConversations,
  getConversationById,
  getMessages,
  deleteConversation,
  searchMessages,
  getConversationStats
} from '../services/conversationService.js';
import logger from '../utils/logger.js';

/**
 * Register conversation handlers on socket
 * @param {Socket} socket - Socket.io socket instance
 */
export const registerConversationHandlers = (socket) => {
  /**
   * Get user conversations
   */
  socket.on('conversation:list',
    async (data, callback) => {
      // Log the socket event
      logger.debug('Socket event: conversation:list', {
        userId: socket.userId,
        socketId: socket.id,
        characterId: socket.characterId
      });
      try {
        const { limit = 20, offset = 0 } = data || {};
        
        const result = await getUserConversations(socket.userId, {
          limit,
          offset
        });
        
        callback({ 
          success: true, 
          ...result 
        });
        
      } catch (error) {
        logger.error('Error getting conversations:', error);
        callback({ 
          success: false, 
          error: 'Failed to get conversations' 
        });
      }
    }
  );
  
  /**
   * Get conversation messages
   */
  socket.on('conversation:messages',
    async (data, callback) => {
      // Log the socket event
      logger.debug('Socket event: conversation:messages', {
        userId: socket.userId,
        socketId: socket.id,
        characterId: socket.characterId
      });
      try {
        const { conversationId, limit = 50, before } = data;
        
        if (!conversationId) {
          return callback({ 
            success: false, 
            error: 'Conversation ID required' 
          });
        }
        
        // Verify user owns the conversation
        const [userId] = conversationId.split('_');
        if (userId !== socket.userId) {
          return callback({ 
            success: false, 
            error: 'Unauthorized' 
          });
        }
        
        const result = await getMessages(conversationId, {
          limit,
          before
        });

        
        callback({ 
          success: true, 
          ...result 
        });
        
      } catch (error) {
        logger.error('Error getting messages:', error);
        callback({ 
          success: false, 
          error: 'Failed to get messages' 
        });
      }
    }
  );
  
  /**
   * Search messages in conversation
   */
  socket.on('conversation:search',
    async (data, callback) => {
      // Log the socket event
      logger.debug('Socket event: conversation:search', {
        userId: socket.userId,
        socketId: socket.id,
        characterId: socket.characterId
      });
      try {
        const { conversationId, query } = data;
        
        if (!conversationId || !query) {
          return callback({ 
            success: false, 
            error: 'Conversation ID and query required' 
          });
        }
        
        // Verify user owns the conversation
        const [userId] = conversationId.split('_');
        if (userId !== socket.userId) {
          return callback({ 
            success: false, 
            error: 'Unauthorized' 
          });
        }
        
        const messages = await searchMessages(conversationId, query);
        
        callback({ 
          success: true, 
          messages,
          count: messages.length 
        });
        
      } catch (error) {
        logger.error('Error searching messages:', error);
        callback({ 
          success: false, 
          error: 'Failed to search messages' 
        });
      }
    }
  );
  
  /**
   * Get conversation statistics
   */
  socket.on('conversation:stats',
    async (data, callback) => {
      // Log the socket event
      logger.debug('Socket event: conversation:stats', {
        userId: socket.userId,
        socketId: socket.id,
        characterId: socket.characterId
      });
      try {
        const { conversationId } = data;
        
        if (!conversationId) {
          return callback({ 
            success: false, 
            error: 'Conversation ID required' 
          });
        }
        
        // Verify user owns the conversation
        const [userId] = conversationId.split('_');
        if (userId !== socket.userId) {
          return callback({ 
            success: false, 
            error: 'Unauthorized' 
          });
        }
        
        const stats = await getConversationStats(conversationId);
        
        callback({ 
          success: true, 
          stats 
        });
        
      } catch (error) {
        logger.error('Error getting conversation stats:', error);
        callback({ 
          success: false, 
          error: 'Failed to get statistics' 
        });
      }
    }
  );
  
  /**
   * Delete conversation
   */
  socket.on('conversation:delete',
    async (data, callback) => {
      // Log the socket event
      logger.debug('Socket event: conversation:delete', {
        userId: socket.userId,
        socketId: socket.id,
        characterId: socket.characterId
      });
      try {
        const { conversationId } = data;
        
        if (!conversationId) {
          return callback({ 
            success: false, 
            error: 'Conversation ID required' 
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
        
        await deleteConversation(conversationId);
        
        // Notify all user devices
        emitToUser(socket.userId, SOCKET_EVENTS.CONVERSATION_DELETE, {
          conversationId,
          characterId
        });
        
        logger.info('Conversation deleted', { 
          userId: socket.userId, 
          conversationId 
        });
        
        callback({ success: true });
        
      } catch (error) {
        logger.error('Error deleting conversation:', error);
        callback({ 
          success: false, 
          error: 'Failed to delete conversation' 
        });
      }
    }
  );

  /**
   * Join conversation room - Fixed version
   * Handles both callback and non-callback scenarios
   */
  socket.on('conversation:join', async (data, callback) => {
    // Handle both single argument (data only) and two arguments (data + callback)
    if (typeof data === 'function') {
      // If first argument is a function, there's no data
      callback = data;
      data = {};
    } else if (!callback || typeof callback !== 'function') {
      // No callback provided, create a no-op
      callback = () => {};
    }

    try {
      // Accept either characterId or conversationId
      let characterId = data.characterId;

      // If conversationId is provided, extract characterId from it
      if (!characterId && data.conversationId) {
        const parts = data.conversationId.split('_');
        characterId = parts[1]; // Assuming format: userId_characterId
      }

      if (!characterId) {
        logger.warn('No character ID provided for conversation:join', {
          userId: socket.userId,
          data
        });
        return callback({
          success: false,
          error: 'Character ID required'
        });
      }

      // Leave previous conversation rooms
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room.startsWith('conversation:') && room !== socket.id) {
          socket.leave(room);
        }
      });

      // Join new conversation room
      const conversationRoom = `conversation:${socket.userId}_${characterId}`;
      socket.join(conversationRoom);
      socket.join(`character:${characterId}`);

      // Update socket data
      socket.characterId = characterId;

      logger.debug('Joined conversation', {
        userId: socket.userId,
        characterId,
        room: conversationRoom
      });

      // Always call callback (even if it's a no-op)
      callback({
        success: true,
        conversationRoom,
        characterId
      });

    } catch (error) {
      logger.error('Error joining conversation:', error);
      callback({
        success: false,
        error: 'Failed to join conversation'
      });
    }
  });

  /**
   * Leave conversation room
   */
  socket.on('conversation:leave', async (data, callback) => {
    // Handle both single argument (data only) and two arguments (data + callback)
    if (typeof data === 'function') {
      // If first argument is a function, there's no data
      callback = data;
      data = {};
    } else if (!callback || typeof callback !== 'function') {
      // No callback provided, create a no-op
      callback = () => {};
    }

    try {
      // Accept either characterId or conversationId
      let characterId = data.characterId;

      // If conversationId is provided, extract characterId from it
      if (!characterId && data.conversationId) {
        const parts = data.conversationId.split('_');
        characterId = parts[1]; // Assuming format: userId_characterId
      }

      if (!characterId) {
        logger.warn('No character ID provided for conversation:leave', {
          userId: socket.userId,
          data
        });
        return callback({
          success: false,
          error: 'Character ID required'
        });
      }

      // Leave conversation rooms
      const conversationRoom = `conversation:${socket.userId}_${characterId}`;
      socket.leave(conversationRoom);
      socket.leave(`character:${characterId}`);

      // Clear socket data
      socket.characterId = null;

      logger.debug('Left conversation', {
        userId: socket.userId,
        characterId,
        room: conversationRoom
      });

      // Always call callback (even if it's a no-op)
      callback({
        success: true,
        conversationRoom,
        characterId
      });

    } catch (error) {
      logger.error('Error leaving conversation:', error);
      callback({
        success: false,
        error: 'Failed to leave conversation'
      });
    }
  });
};

export default {
  registerConversationHandlers
}; 