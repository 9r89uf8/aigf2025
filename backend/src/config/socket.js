/**
 * Socket.io configuration
 * Manages real-time WebSocket connections
 */
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedisClient, getSubscriberClient } from './redis.js';
import { config } from './environment.js';
import { verifySocketToken } from '../middleware/socketAuth.js';
import logger from '../utils/logger.js';

let io = null;

/**
 * Initialize Socket.io server
 * @param {Object} server - HTTP server instance
 * @returns {Server} Socket.io instance
 */
export const initializeSocket = (server) => {
  try {
    // Create Socket.io server
    io = new Server(server, {
      cors: {
        origin: config.isDevelopment 
          ? ['http://localhost:3001', 'http://localhost:3000']
          : process.env.FRONTEND_URL,
        credentials: true
      },
      pingTimeout: 120000, // 2 minutes - increased timeout
      pingInterval: 25000,  // Keep existing interval
      transports: ['websocket', 'polling'],
      allowEIO3: true, // Allow different Socket.io versions
      connectTimeout: 45000, // 45 seconds connection timeout
      upgradeTimeout: 30000  // 30 seconds upgrade timeout
    });

    // Setup Redis adapter for horizontal scaling
    if (config.redis.host) {
      const pubClient = getRedisClient();
      const subClient = getSubscriberClient();
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.io Redis adapter initialized');
    }

    // Authentication middleware
    io.use(verifySocketToken);

    // Connection handling
    io.on('connection', (socket) => {
      logger.info('Socket connected', { 
        socketId: socket.id, 
        userId: socket.userId,
        characterId: socket.characterId 
      });

      // Join user room for private messages
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Join character room if specified
      if (socket.characterId) {
        socket.join(`character:${socket.characterId}`);
        socket.join(`conversation:${socket.userId}_${socket.characterId}`);
      }

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info('Socket disconnected', { 
          socketId: socket.id, 
          userId: socket.userId,
          reason 
        });
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('Socket error', { 
          socketId: socket.id, 
          error: error.message 
        });
      });
    });

    logger.info('Socket.io server initialized');
    return io;
  } catch (error) {
    logger.error('Failed to initialize Socket.io:', error);
    throw error;
  }
};

/**
 * Get Socket.io instance
 * @returns {Server} Socket.io instance
 */
export const getSocketIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

/**
 * Emit event to specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
export const emitToUser = (userId, event, data) => {
  try {
    const socketIO = getSocketIO();
    socketIO.to(`user:${userId}`).emit(event, data);
    logger.debug('Event emitted to user', { userId, event });
  } catch (error) {
    logger.error('Error emitting to user:', error);
  }
};

/**
 * Emit event to conversation room
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
export const emitToConversation = (userId, characterId, event, data) => {
  try {
    const socketIO = getSocketIO();
    const room = `conversation:${userId}_${characterId}`;
    socketIO.to(room).emit(event, data);
    logger.debug('Event emitted to conversation', { room, event });
  } catch (error) {
    logger.error('Error emitting to conversation:', error);
  }
};

/**
 * Emit event to all character subscribers
 * @param {string} characterId - Character ID
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
export const emitToCharacter = (characterId, event, data) => {
  try {
    const socketIO = getSocketIO();
    socketIO.to(`character:${characterId}`).emit(event, data);
    logger.debug('Event emitted to character subscribers', { characterId, event });
  } catch (error) {
    logger.error('Error emitting to character:', error);
  }
};

/**
 * Get active socket connections for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of active connections
 */
export const getUserConnectionCount = async (userId) => {
  try {
    const socketIO = getSocketIO();
    const sockets = await socketIO.in(`user:${userId}`).fetchSockets();
    return sockets.length;
  } catch (error) {
    logger.error('Error getting user connections:', error);
    return 0;
  }
};

/**
 * Disconnect all sockets for a user
 * @param {string} userId - User ID
 * @param {string} reason - Disconnect reason
 */
export const disconnectUser = async (userId, reason = 'user_disconnect') => {
  try {
    const socketIO = getSocketIO();
    const sockets = await socketIO.in(`user:${userId}`).fetchSockets();
    
    for (const socket of sockets) {
      socket.disconnect(true);
    }
    
    logger.info('User sockets disconnected', { userId, count: sockets.length, reason });
  } catch (error) {
    logger.error('Error disconnecting user:', error);
  }
};

/**
 * Get room members count
 * @param {string} room - Room name
 * @returns {Promise<number>} Number of members
 */
export const getRoomMemberCount = async (room) => {
  try {
    const socketIO = getSocketIO();
    const sockets = await socketIO.in(room).fetchSockets();
    return sockets.length;
  } catch (error) {
    logger.error('Error getting room members:', error);
    return 0;
  }
};

/**
 * Socket.io event names
 */
export const SOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Message events
  MESSAGE_SEND: 'message:send',
  MESSAGE_RECEIVE: 'message:receive',
  MESSAGE_STATUS: 'message:status',
  MESSAGE_READ: 'message:read',
  MESSAGE_RETRY: 'message:retry',
  
  // Natural Queuing System events
  MESSAGE_QUEUED: 'message:queued',
  MESSAGE_PROCESSING: 'message:processing',
  MESSAGE_RESPONSE_LINKED: 'message:response_linked',
  QUEUE_STATUS: 'queue:status',
  
  // Typing events
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  
  // Character events
  CHARACTER_STATUS: 'character:status',
  CHARACTER_UPDATE: 'character:update',
  
  // User events
  USER_STATUS: 'user:status',
  USER_UPDATE: 'user:update',
  
  // Conversation events
  CONVERSATION_UPDATE: 'conversation:update',
  CONVERSATION_DELETE: 'conversation:delete',
  
  // Error events
  AUTH_ERROR: 'auth:error',
  RATE_LIMIT: 'rate:limit',
  USAGE_LIMIT: 'usage:limit'
};

export default {
  initializeSocket,
  getSocketIO,
  emitToUser,
  emitToConversation,
  emitToCharacter,
  getUserConnectionCount,
  disconnectUser,
  getRoomMemberCount,
  SOCKET_EVENTS
}; 