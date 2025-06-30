/**
 * Socket.io Client Setup
 * Manages WebSocket connection with authentication and auto-reconnect
 */
import { io } from 'socket.io-client';
import { auth } from '../firebase/config';

class SocketClient {
  constructor() {
    this.socket = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.heartbeatInterval = null;
  }

  /**
   * Initialize socket connection with auth token
   */
  async connect() {
    if (this.isConnecting) {
      // Wait for current connection attempt to complete
      return new Promise((resolve) => {
        const checkConnection = () => {
          if (!this.isConnecting) {
            resolve(this.socket);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    try {
      this.isConnecting = true;

      // Get auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const token = await user.getIdToken();

      // Create socket connection
      this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5,
        autoConnect: true,
        forceNew: false
      });

      this.setupEventHandlers();
      
      // Wait for connection to be established
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.isConnecting = false;
          reject(new Error('Connection timeout'));
        }, 20000);

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          resolve(this.socket);
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          reject(error);
        });
      });
    } catch (error) {
      console.error('Socket connection failed:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  /**
   * Set up core socket event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Remove any existing listeners to prevent duplicates
    this.socket.removeAllListeners();

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emitToListeners('connected', { id: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.stopHeartbeat();
      this.emitToListeners('disconnected', { reason });

      // Auto-reconnect logic for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'ping timeout' || reason === 'transport close') {
        // Server disconnected or connection lost, attempt reconnect
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.emitToListeners('error', { error: error.message });
      this.handleReconnect();
    });

    // Auth error
    this.socket.on('auth_error', (error) => {
      console.error('Socket auth error:', error);
      this.emitToListeners('auth_error', { error });
      this.disconnect();
    });
  }

  /**
   * Handle reconnection attempts
   */
  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emitToListeners('max_reconnect_reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      try {
        // Get fresh auth token before reconnecting
        const user = auth.currentUser;
        if (user) {
          const token = await user.getIdToken(true); // Force refresh
          if (this.socket) {
            this.socket.auth.token = token;
          }
        }
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        // Continue retrying unless auth error
        if (!error.message?.includes('auth')) {
          this.handleReconnect();
        }
      }
    }, delay);
  }

  /**
   * Join a conversation room
   * @param {string} conversationId - The conversation ID (format: userId_characterId)
   * @returns {Promise} Resolves when joined successfully
   */
  joinConversation(conversationId) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      // Extract characterId from conversationId
      const parts = conversationId.split('_');
      const characterId = parts[1] || conversationId;

      this.socket.emit('conversation:join',
          { characterId },
          (response) => {
            if (response.success) {
              console.log('Joined conversation:', conversationId);
              resolve(response);
            } else {
              console.error('Failed to join conversation:', response.error);
              reject(new Error(response.error));
            }
          }
      );
    });
  }

  /**
   * Leave a conversation room
   * @param {string} conversationId - The conversation ID
   * @returns {Promise} Resolves when left successfully
   */
  leaveConversation(conversationId) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      // Extract characterId from conversationId
      const parts = conversationId.split('_');
      const characterId = parts[1] || conversationId;

      this.socket.emit('conversation:leave',
          { characterId },
          (response) => {
            if (response.success) {
              console.log('Left conversation:', conversationId);
              resolve(response);
            } else {
              console.error('Failed to leave conversation:', response.error);
              reject(new Error(response.error));
            }
          }
      );
    });
  }

  /**
   * Send a message with callback
   * @param {Object} data - Message data
   * @returns {Promise} Resolves with server response
   */
  sendMessage(data) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('message:send', data, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to send message'));
        }
      });
    });
  }

  /**
   * Get conversation list
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise} Resolves with conversations
   */
  getConversations(options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('conversation:list', options, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to get conversations'));
        }
      });
    });
  }

  /**
   * Get messages for a conversation
   * @param {string} conversationId - The conversation ID
   * @param {Object} options - Query options (limit, before)
   * @returns {Promise} Resolves with messages
   */
  getMessages(conversationId, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('conversation:messages',
          { conversationId, ...options },
          (response) => {
            if (response.success) {
              console.log('🔌 WebSocket conversation:messages response:', {
                conversationId,
                messageCount: response.messages?.length || 0,
                options,
                fullResponse: response,
                messages: response.messages?.map(m => ({
                  id: m.id,
                  sender: m.sender,
                  timestamp: m.timestamp,
                  content: m.content?.substring(0, 50) + '...',
                  hasReplyToMessageId: !!m.replyToMessageId,
                  replyToMessageId: m.replyToMessageId,
                  allFields: Object.keys(m)
                }))
              });
              resolve(response);
            } else {
              reject(new Error(response.error || 'Failed to get messages'));
            }
          }
      );
    });
  }

  /**
   * Mark message as read
   */
  markMessageRead(messageId, conversationId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('message:read', { messageId, conversationId });
    }
  }

  /**
   * Retry a failed message
   * @param {string} conversationId - The conversation ID
   * @param {string} messageId - The message ID to retry
   * @param {string} characterId - The character ID
   * @returns {Promise} Resolves with server response
   */
  retryMessage(conversationId, messageId, characterId) {
    return new Promise((resolve, reject) => {
      console.log('🔌 SOCKET: Initiating retry via WebSocket:', {
        conversationId,
        messageId,
        characterId,
        socketConnected: this.socket?.connected
      });
      
      if (!this.socket || !this.socket.connected) {
        console.log('🔌 SOCKET: Socket not connected, rejecting retry');
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('message:retry', 
        { conversationId, messageId, characterId }, 
        (response) => {
          console.log('🔌 SOCKET: Retry response received:', {
            response,
            responseType: typeof response,
            success: response?.success,
            error: response?.error,
            retryLimitReached: response?.retryLimitReached,
            fullResponse: JSON.stringify(response)
          });
          
          if (response && response.success) {
            console.log('🔌 SOCKET: Retry successful, resolving');
            resolve(response);
          } else {
            console.log('🔌 SOCKET: Retry failed, but resolving anyway to handle in store:', response?.error || 'Failed to retry message');
            
            // Always resolve with the response so we can handle specific error types in the store
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId, isTyping) {
    if (this.socket && this.socket.connected) {
      const event = isTyping ? 'typing:start' : 'typing:stop';
      this.socket.emit(event, { conversationId });
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Also listen on socket if connected
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }

    // Also remove from socket if connected
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit to registered listeners
   */
  emitToListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing interval
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping', (response) => {
          if (!response || !response.success) {
            console.warn('Heartbeat failed');
          }
        });
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Get connection status
   */
  get isConnected() {
    return this.socket && this.socket.connected;
  }

  /**
   * Get socket ID
   */
  get socketId() {
    return this.socket ? this.socket.id : null;
  }
}

// Create singleton instance
const socketClient = new SocketClient();

export default socketClient;