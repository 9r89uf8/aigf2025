/**
 * Socket.io Event Handlers
 * Centralized event handling for all socket events
 */

/**
 * Message Events Handler
 */
export class MessageEventsHandler {
  constructor(socket, chatStore) {
    this.socket = socket;
    this.chatStore = chatStore;
    this.setupListeners();
  }

  setupListeners() {
    // Incoming message
    this.socket.on('message:receive', (data) => {
      this.handleMessageReceive(data);
    });

    // Message status updates
    this.socket.on('message:status', (data) => {
      this.handleMessageStatus(data);
    });

    // Message delivery confirmation
    this.socket.on('message:delivered', (data) => {
      this.handleMessageDelivered(data);
    });

    // Message read confirmation
    this.socket.on('message:read', (data) => {
      this.handleMessageRead(data);
    });

    // Message liked by AI
    this.socket.on('message:liked', (data) => {
      this.handleMessageLiked(data);
    });
  }

  handleMessageReceive(data) {
    const { conversationId, message, usage } = data;
    
    // Update chat store with new message
    this.chatStore.getState().handleMessageReceived({
      conversationId,
      message: {
        ...message,
        timestamp: new Date(message.timestamp)
      }
    });

    // Update usage if provided
    if (usage) {
      this.chatStore.getState().updateUsage(usage);
    }

    // Show notification if conversation is not active
    const activeConversationId = this.chatStore.getState().activeConversationId;
    if (conversationId !== activeConversationId && message.sender !== 'user') {
      this.showMessageNotification(message);
    }
  }

  handleMessageStatus(data) {
    this.chatStore.getState().handleMessageStatus(data);
  }

  handleMessageDelivered(data) {
    this.chatStore.getState().handleMessageStatus({
      ...data,
      status: 'delivered'
    });
  }

  handleMessageRead(data) {
    this.chatStore.getState().handleMessageStatus({
      ...data,
      status: 'read'
    });
  }

  handleMessageLiked(data) {
    console.log('🎉 Received message:liked event', data);
    const { messageId, likedBy, isLiked, isAILike, characterName } = data;
    
    console.log('Processing AI like:', { messageId, likedBy, isLiked, isAILike, characterName });
    
    // Update liked messages in chat store
    this.chatStore.getState().handleAILike({
      messageId,
      likedBy,
      isLiked,
      isAILike,
      characterName
    });
    
    console.log('AI like processed successfully');
  }

  showMessageNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New message from ${message.characterName}`, {
        body: message.type === 'text' ? message.content : `Sent a ${message.type}`,
        icon: message.characterAvatar || '/default-avatar.png'
      });
    }
  }
}

/**
 * Typing Events Handler
 */
export class TypingEventsHandler {
  constructor(socket, chatStore) {
    this.socket = socket;
    this.chatStore = chatStore;
    this.setupListeners();
  }

  setupListeners() {
    this.socket.on('typing:indicator', (data) => {
      this.handleTypingIndicator(data);
    });

    this.socket.on('typing:start', (data) => {
      this.handleTypingStart(data);
    });

    this.socket.on('typing:stop', (data) => {
      this.handleTypingStop(data);
    });
  }

  handleTypingIndicator(data) {
    this.chatStore.getState().handleTypingIndicator(data);
  }

  handleTypingStart(data) {
    this.chatStore.getState().handleTypingIndicator({
      ...data,
      isTyping: true
    });
  }

  handleTypingStop(data) {
    this.chatStore.getState().handleTypingIndicator({
      ...data,
      isTyping: false
    });
  }
}

/**
 * Usage Events Handler
 */
export class UsageEventsHandler {
  constructor(socket, chatStore) {
    this.socket = socket;
    this.chatStore = chatStore;
    this.setupListeners();
  }

  setupListeners() {
    this.socket.on('usage:update', (data) => {
      this.handleUsageUpdate(data);
    });

    this.socket.on('usage:limit_reached', (data) => {
      this.handleUsageLimitReached(data);
    });

    this.socket.on('usage:warning', (data) => {
      this.handleUsageWarning(data);
    });
  }

  handleUsageUpdate(data) {
    this.chatStore.getState().updateUsage(data.usage);
  }

  handleUsageLimitReached(data) {
    const { type, limit } = data;
    
    // Show toast notification
    if (typeof window !== 'undefined' && window.toast) {
      window.toast.error(
        `You've reached your ${type} message limit (${limit}). Upgrade to premium for unlimited messages!`
      );
    }

    // Update usage in store
    this.chatStore.getState().updateUsage(data.usage);
  }

  handleUsageWarning(data) {
    const { type, used, limit, percentage } = data;
    
    // Show warning at 80% usage
    if (percentage >= 80 && typeof window !== 'undefined' && window.toast) {
      window.toast.warning(
        `You've used ${used}/${limit} ${type} messages (${percentage}%). Consider upgrading to premium.`
      );
    }

    this.chatStore.getState().updateUsage(data.usage);
  }
}

/**
 * Connection Events Handler
 */
export class ConnectionEventsHandler {
  constructor(socket, chatStore) {
    this.socket = socket;
    this.chatStore = chatStore;
    this.setupListeners();
  }

  setupListeners() {
    this.socket.on('connect', () => {
      this.handleConnect();
    });

    this.socket.on('disconnect', (reason) => {
      this.handleDisconnect(reason);
    });

    this.socket.on('connect_error', (error) => {
      this.handleConnectError(error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.handleReconnect(attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      this.handleReconnectError(error);
    });

    this.socket.on('reconnect_failed', () => {
      this.handleReconnectFailed();
    });
  }

  handleConnect() {
    console.log('Socket connected successfully');
    
    // Update connection status in store
    this.chatStore.setState({
      isConnected: true,
      isConnecting: false,
      connectionError: null
    });

    // Rejoin active conversation if any
    const activeConversationId = this.chatStore.getState().activeConversationId;
    if (activeConversationId) {
      this.socket.emit('conversation:join', { conversationId: activeConversationId });
    }
  }

  handleDisconnect(reason) {
    console.log('Socket disconnected:', reason);
    
    this.chatStore.setState({
      isConnected: false,
      connectionError: reason === 'io server disconnect' ? 'Server disconnected' : null
    });
  }

  handleConnectError(error) {
    console.error('Socket connection error:', error);
    
    this.chatStore.setState({
      isConnected: false,
      isConnecting: false,
      connectionError: error.message || 'Connection failed'
    });
  }

  handleReconnect(attemptNumber) {
    console.log(`Socket reconnected after ${attemptNumber} attempts`);
    
    this.chatStore.setState({
      isConnected: true,
      connectionError: null
    });
  }

  handleReconnectError(error) {
    console.error('Socket reconnection error:', error);
  }

  handleReconnectFailed() {
    console.error('Socket reconnection failed');
    
    this.chatStore.setState({
      connectionError: 'Failed to reconnect. Please refresh the page.'
    });
  }
}

/**
 * Error Events Handler
 */
export class ErrorEventsHandler {
  constructor(socket, chatStore) {
    this.socket = socket;
    this.chatStore = chatStore;
    this.setupListeners();
  }

  setupListeners() {
    this.socket.on('error', (error) => {
      this.handleError(error);
    });

    this.socket.on('auth_error', (error) => {
      this.handleAuthError(error);
    });

    this.socket.on('validation_error', (error) => {
      this.handleValidationError(error);
    });

    this.socket.on('rate_limit_error', (error) => {
      this.handleRateLimitError(error);
    });
  }

  handleError(error) {
    console.error('Socket error:', error);
    
    if (typeof window !== 'undefined' && window.toast) {
      window.toast.error(error.message || 'An error occurred');
    }
  }

  handleAuthError(error) {
    console.error('Socket auth error:', error);
    
    // Redirect to login or refresh token
    if (typeof window !== 'undefined') {
      if (window.toast) {
        window.toast.error('Authentication failed. Please log in again.');
      }
      
      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
  }

  handleValidationError(error) {
    console.error('Socket validation error:', error);
    
    if (typeof window !== 'undefined' && window.toast) {
      window.toast.error(error.message || 'Validation failed');
    }
  }

  handleRateLimitError(error) {
    console.error('Socket rate limit error:', error);
    
    if (typeof window !== 'undefined' && window.toast) {
      window.toast.error('Too many requests. Please slow down.');
    }
  }
}

/**
 * Event Handler Manager
 * Manages all event handlers for a socket connection
 */
export class EventHandlerManager {
  constructor(socket, chatStore) {
    this.socket = socket;
    this.chatStore = chatStore;
    this.handlers = [];
    
    this.initialize();
  }

  initialize() {
    // Create all event handlers
    this.handlers = [
      new MessageEventsHandler(this.socket, this.chatStore),
      new TypingEventsHandler(this.socket, this.chatStore),
      new UsageEventsHandler(this.socket, this.chatStore),
      new ConnectionEventsHandler(this.socket, this.chatStore),
      new ErrorEventsHandler(this.socket, this.chatStore)
    ];
  }

  destroy() {
    // Clean up handlers if needed
    this.handlers = [];
  }
}

export default EventHandlerManager;