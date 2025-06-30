/**
 * Socket.io manager
 * Registers all socket handlers and manages connections
 */
import { getSocketIO } from '../config/socket.js';
import { registerMessageHandlers } from './messageHandler.js';
import { registerConversationHandlers } from './conversationHandler.js';
import logger from '../utils/logger.js';

/**
 * Register all socket handlers
 * @param {Server} io - Socket.io server instance
 * @param {Object} queues - Bull queues
 */
export const registerSocketHandlers = (io, queues) => {
  // Attach queues to io instance for access in handlers
  io.queues = queues;
  
  io.on('connection', (socket) => {
    try {
      console.log('Connection established, socket.id:', socket.id);
      console.log('Socket.user:', socket.user);

      // Join user to their personal room for notifications
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
        logger.debug('User joined personal room', { 
          userId: socket.userId, 
          room: `user:${socket.userId}` 
        });
      }

      // Log all event registrations
      socket.onAny((eventName, ...args) => {
        // console.log(`Event received: ${eventName}`, args);
      });
      // Register message handlers
      registerMessageHandlers(socket);
      
      // Register conversation handlers
      registerConversationHandlers(socket);
      
      // Handle user status updates
      socket.on('user:status', async (data) => {
        const { status } = data;
        
        if (status && socket.userId) {
          // Broadcast to all user's devices
          socket.to(`user:${socket.userId}`).emit('user:status', {
            userId: socket.userId,
            status,
            timestamp: new Date()
          });
        }
      });
      
      // Handle character subscription
      socket.on('character:subscribe', async (data) => {
        const { characterId } = data;
        
        if (characterId) {
          socket.join(`character:${characterId}`);
          logger.debug('Subscribed to character', { 
            userId: socket.userId, 
            characterId 
          });
        }
      });
      
      // Handle character unsubscription
      socket.on('character:unsubscribe', async (data) => {
        const { characterId } = data;
        
        if (characterId) {
          socket.leave(`character:${characterId}`);
          logger.debug('Unsubscribed from character', { 
            userId: socket.userId, 
            characterId 
          });
        }
      });
      
      // Handle ping for connection health
      socket.on('ping', (callback) => {
        if (typeof callback === 'function') {
          callback({ 
            success: true, 
            timestamp: Date.now() 
          });
        }
      });
      
    } catch (error) {
      logger.error('Error registering socket handlers:', error);
    }
  });
};

/**
 * Get online users count
 * @returns {Promise<number>} Number of online users
 */
export const getOnlineUsersCount = async () => {
  try {
    const io = getSocketIO();
    const sockets = await io.fetchSockets();
    
    // Get unique user IDs
    const userIds = new Set();
    sockets.forEach(socket => {
      if (socket.userId) {
        userIds.add(socket.userId);
      }
    });
    
    return userIds.size;
  } catch (error) {
    logger.error('Error getting online users count:', error);
    return 0;
  }
};

/**
 * Get character room members
 * @param {string} characterId - Character ID
 * @returns {Promise<string[]>} Array of user IDs
 */
export const getCharacterRoomMembers = async (characterId) => {
  try {
    const io = getSocketIO();
    const sockets = await io.in(`character:${characterId}`).fetchSockets();
    
    const userIds = sockets
      .map(socket => socket.userId)
      .filter(Boolean);
    
    return [...new Set(userIds)]; // Remove duplicates
  } catch (error) {
    logger.error('Error getting character room members:', error);
    return [];
  }
};

/**
 * Broadcast character update to subscribers
 * @param {string} characterId - Character ID
 * @param {Object} update - Update data
 */
export const broadcastCharacterUpdate = (characterId, update) => {
  try {
    const io = getSocketIO();
    io.to(`character:${characterId}`).emit('character:update', {
      characterId,
      update,
      timestamp: new Date()
    });
    
    logger.debug('Character update broadcast', { characterId });
  } catch (error) {
    logger.error('Error broadcasting character update:', error);
  }
};

/**
 * Notify user of system events
 * @param {string} userId - User ID
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
export const notifyUser = (userId, event, data) => {
  try {
    const io = getSocketIO();
    io.to(`user:${userId}`).emit('system:notification', {
      event,
      data,
      timestamp: new Date()
    });
    
    logger.debug('User notification sent', { userId, event });
  } catch (error) {
    logger.error('Error sending user notification:', error);
  }
};

export default {
  registerSocketHandlers,
  getOnlineUsersCount,
  getCharacterRoomMembers,
  broadcastCharacterUpdate,
  notifyUser
}; 