/**
 * Chat Store using Zustand
 * this store will be called by the chat page to connect to socket
 * Manages real-time messaging, conversations, and Socket.io integration
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import socketClient from '../lib/socket/client';
import { apiClient } from '../lib/api/client';
import { generateMessageId } from '../lib/utils/generateId';
import toast from 'react-hot-toast';

const useChatStore = create(
    subscribeWithSelector((set, get) => ({
        // Connection state
        isConnected: false,
        isConnecting: false,
        connectionError: null,

        // Conversations
        conversations: new Map(),
        activeConversationId: null,

        // Messages
        messages: new Map(), // conversationId -> messages array
        sendingMessages: new Map(), // temporary messages being sent
        failedMessages: new Set(), // failed message IDs
        likedMessages: [], // liked message IDs array
        llmErrorMessages: new Set(), // message IDs with LLM errors

        // Natural Message Queuing System
        messageQueues: new Map(), // conversationId -> queue state
        queueStatus: new Map(), // conversationId -> { state, queueLength, processing }
        messageRelationships: new Map(), // responseMessageId -> originalMessageId

        // Typing indicators
        typingUsers: new Map(), // conversationId -> Set of typing users

        // Usage tracking - per character
        characterUsage: new Map(), // characterId -> { text: {used, limit}, image: {used, limit}, audio: {used, limit} }

        /**
         * Initialize chat store and socket connection
         */
        initialize: async () => {
            const state = get();
            
            // Prevent multiple initializations
            if (state.isConnecting || state.isConnected) {
                console.log('Chat already initializing or connected, skipping...');
                return;
            }

            try {
                set({ isConnecting: true, connectionError: null });

                // Connect to socket
                await socketClient.connect();

                // Set up event listeners
                get().setupSocketListeners();

                // Fetch initial usage data
                await get().fetchInitialUsage();

                set({ isConnected: true, isConnecting: false });
                console.log('Chat initialized successfully');
            } catch (error) {
                console.error('Chat initialization failed:', error);
                set({
                    isConnected: false,
                    isConnecting: false,
                    connectionError: error.message
                });
                toast.error('Failed to connect to chat service');
            }
        },

        /**
         * Set up socket event listeners
         */
        setupSocketListeners: () => {
            // Clear any existing listeners first
            const eventTypes = [
                'connected', 'disconnected', 'error', 'max_reconnect_reached', 
                'message:receive', 'message:status', 'message:liked', 'typing:indicator', 'usage:update',
                // Natural queuing system events
                'message:queued', 'message:processing', 'queue:status', 'message:response_linked',
                // LLM error handling
                'message:llm_error'
            ];
            eventTypes.forEach(event => {
                socketClient.off(event);
            });

            // Connection events
            socketClient.on('connected', () => {
                console.log('Socket connected successfully');
                set({ isConnected: true, connectionError: null });
            });

            socketClient.on('disconnected', ({ reason }) => {
                console.log('Socket disconnected:', reason);
                set({ isConnected: false });
                // Don't show error for intentional disconnects
                if (reason !== 'io client disconnect') {
                    toast.error('Connection lost. Reconnecting...');
                }
            });

            socketClient.on('error', ({ error }) => {
                console.error('Socket error:', error);
                set({ connectionError: error });
                if (!error.includes('auth')) {
                    toast.error('Connection error');
                }
            });

            socketClient.on('max_reconnect_reached', () => {
                console.error('Maximum reconnection attempts reached');
                set({ connectionError: 'Unable to reconnect. Please refresh the page.' });
                toast.error('Connection failed. Please refresh the page.');
            });

            // Message events
            socketClient.on('message:receive', (data) => {
                get().handleMessageReceived(data);
            });

            socketClient.on('message:status', (data) => {
                get().handleMessageStatus(data);
            });

            // Message liked events
            socketClient.on('message:liked', (data) => {
                console.log('🔥 Chat store received message:liked event:', data);
                get().handleAILike(data);
            });

            // Typing events
            socketClient.on('typing:indicator', (data) => {
                get().handleTypingIndicator(data);
            });

            // Usage events
            socketClient.on('usage:update', (data) => {
                get().updateUsage(data);
            });

            // Natural Message Queuing System events
            socketClient.on('message:queued', (data) => {
                get().handleMessageQueued(data);
            });

            socketClient.on('message:processing', (data) => {
                get().handleMessageProcessing(data);
            });

            socketClient.on('queue:status', (data) => {
                get().handleQueueStatus(data);
            });

            socketClient.on('message:response_linked', (data) => {
                get().handleMessageResponseLinked(data);
            });

            // LLM error handling
            socketClient.on('message:llm_error', (data) => {
                get().handleLLMError(data);
            });
        },

        /**
         * Join a conversation
         */
        joinConversation: async (conversationId, characterId) => {
            try {
                set({ activeConversationId: conversationId });

                // Load conversation data first (this will create it if it doesn't exist)
                let conversation;
                if (!get().conversations.has(conversationId)) {
                    conversation = await get().loadConversation(conversationId, characterId);
                } else {
                    conversation = get().conversations.get(conversationId);
                }

                // Join socket room with callback (only if socket is connected)
                if (socketClient.isConnected) {
                    try {
                        await socketClient.joinConversation(conversationId);
                        console.log('Successfully joined socket room for conversation:', conversationId);
                    } catch (socketError) {
                        console.error('Socket join error:', socketError);
                        // Continue even if socket join fails - we can still load data
                    }
                }

                // Load messages if not already loaded
                if (!get().messages.has(conversationId)) {
                    await get().loadMessages(conversationId);
                }

                return conversation;
            } catch (error) {
                console.error('Failed to join conversation:', error);
                toast.error('Failed to join conversation');
                throw error;
            }
        },

        /**
         * Leave current conversation
         */
        leaveConversation: async () => {
            const { activeConversationId } = get();
            if (activeConversationId) {
                try {
                    await socketClient.leaveConversation(activeConversationId);
                } catch (error) {
                    console.error('Failed to leave conversation:', error);
                    // Don't show error toast for leaving - not critical
                }
                set({ activeConversationId: null });
            }
        },

        /**
         * Load conversation data
         */
        loadConversation: async (conversationId, characterId) => {
            try {
                const response = await apiClient.get(`/conversations/${conversationId}`);
                const conversation = response.data.conversation;
                
                // Log conversation data for debugging
                console.log('🔍 Frontend received conversation:', {
                    conversationId,
                    messageCount: conversation.messages?.length || 0,
                    conversation: conversation,
                    messages: conversation.messages?.map(m => ({
                        id: m.id,
                        sender: m.sender,
                        timestamp: m.timestamp,
                        content: m.content?.substring(0, 50) + '...',
                        hasReplyToMessageId: !!m.replyToMessageId,
                        replyToMessageId: m.replyToMessageId,
                        allFields: Object.keys(m)
                    }))
                });

                set(state => ({
                    conversations: new Map(state.conversations.set(conversationId, conversation))
                }));
                
                return conversation;
            } catch (error) {
                console.error('Failed to load conversation:', error);

                // If conversation doesn't exist, create it
                if (error.response?.status === 404) {
                    const newConversation = await get().createConversation(characterId);
                    return newConversation;
                }
                throw error;
            }
        },

        /**
         * Create new conversation
         */
        createConversation: async (characterId) => {
            try {
                const response = await apiClient.post('/conversations', {
                    characterId
                });
                const conversation = response.data.conversation;

                set(state => ({
                    conversations: new Map(state.conversations.set(conversation.id, conversation))
                }));

                return conversation;
            } catch (error) {
                console.error('Failed to create conversation:', error);
                toast.error('Failed to create conversation');
                throw error;
            }
        },

        /**
         * Load messages for a conversation
         */
        loadMessages: async (conversationId, limit = 50, before = null) => {
            try {
                let messages = [];
                
                // Try to load via socket first if connected
                if (socketClient.isConnected) {
                    try {
                        const response = await socketClient.getMessages(conversationId, { limit, before });
                        messages = response.messages;
                        
                        console.log('📡 Messages loaded via WebSocket:', {
                            conversationId,
                            messageCount: messages.length,
                            limit,
                            before,
                            messages: messages.map(m => ({
                                id: m.id,
                                sender: m.sender,
                                timestamp: m.timestamp,
                                content: m.content?.substring(0, 50) + '...',
                                hasReplyToMessageId: !!m.replyToMessageId,
                                replyToMessageId: m.replyToMessageId,
                                allFields: Object.keys(m)
                            }))
                        });
                    } catch (socketError) {
                        console.warn('Socket message load failed, falling back to API:', socketError);
                    }
                }

                // Fallback to API if socket failed or not connected
                if (messages.length === 0) {
                    const params = { limit };
                    if (before) params.before = before;

                    const response = await apiClient.get(`/conversations/${conversationId}/messages`, {
                        params
                    });
                    messages = response.data.messages;
                    
                    console.log('🌐 Messages loaded via API:', {
                        conversationId,
                        messageCount: messages.length,
                        limit,
                        before,
                        messages: messages.map(m => ({
                            id: m.id,
                            sender: m.sender,
                            timestamp: m.timestamp,
                            content: m.content?.substring(0, 50) + '...'
                        }))
                    });
                }

                // Extract liked messages for current user
                const { user } = await import('../stores/authStore.js').then(m => m.default.getState());
                const currentUserId = user?.uid;
                
                set(state => {
                    const existingMessages = state.messages.get(conversationId) || [];
                    const allMessages = before
                        ? [...messages, ...existingMessages]
                        : messages;
                        
                    // Sort all messages by timestamp to ensure chronological order
                    const beforeSort = [...allMessages];
                    const sortedMessages = allMessages.sort((a, b) => {
                        const getTimestamp = (timestamp) => {
                            if (!timestamp) return 0;
                            
                            // Handle Firebase Timestamp object
                            if (timestamp._seconds) {
                                return timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000;
                            }
                            
                            // Handle ISO string or regular Date
                            return new Date(timestamp).getTime();
                        };
                        
                        return getTimestamp(a.timestamp) - getTimestamp(b.timestamp);
                    });
                    
                    // Log ordering for debugging
                    const sortingChanged = JSON.stringify(beforeSort.map(m => m.id)) !== JSON.stringify(sortedMessages.map(m => m.id));
                    if (sortingChanged) {
                        console.log('🔄 Message sorting applied:', {
                            conversationId,
                            messageCount: sortedMessages.length,
                            chronologicalCount: chronologicalMessages.length,
                            conversationFlowOrder: sortedMessages.map(m => ({
                                id: m.id,
                                timestamp: m.timestamp,
                                sender: m.sender,
                                replyTo: m.replyToMessageId
                            }))
                        });
                    }

                    // Update liked messages array based on message likes
                    const likedMessages = [];
                    if (currentUserId) {
                        sortedMessages.forEach(msg => {
                            let shouldLike = false;
                            
                            // Check for user likes on AI messages
                            if (msg.likes && msg.likes[currentUserId]) {
                                shouldLike = true;
                            }
                            
                            // Check for AI likes on user messages
                            if (msg.likes && msg.sender === 'user') {
                                // Look for any AI likes (keys starting with 'ai_')
                                const hasAILike = Object.keys(msg.likes).some(key => 
                                    key.startsWith('ai_') && msg.likes[key]
                                );
                                if (hasAILike) {
                                    shouldLike = true;
                                }
                            }
                            
                            if (shouldLike) {
                                likedMessages.push(msg.id);
                            }
                        });
                    }

                    // Extract LLM error messages from database
                    const llmErrorMessages = new Set(state.llmErrorMessages);
                    sortedMessages.forEach(msg => {
                        if (msg.hasLLMError === true) {
                            llmErrorMessages.add(msg.id);
                        }
                    });

                    return {
                        messages: new Map(state.messages.set(conversationId, sortedMessages)),
                        likedMessages,
                        llmErrorMessages
                    };
                });

                return messages;
            } catch (error) {
                console.error('Failed to load messages:', error);
                toast.error('Failed to load messages');
            }
        },

        /**
         * Send a message
         */
        sendMessage: async (conversationId, content, type = 'text', metadata = {}) => {
            try {
                // Extract characterId from conversationId (format: userId_characterId)
                const parts = conversationId.split('_');
                const characterId = parts[1];
                
                if (!characterId) {
                    throw new Error('Invalid conversation ID format');
                }

                // Check usage limits for this character
                const characterUsage = get().getCharacterUsage(characterId);
                if (characterUsage[type] && characterUsage[type].used >= characterUsage[type].limit) {
                    toast.error(`${type} message limit reached for this character. Upgrade to premium for unlimited messages.`);
                    return;
                }

                // Create message with proper UUID for optimistic update
                const messageId = generateMessageId();
                const optimisticMessage = {
                    id: messageId,
                    content,
                    type,
                    metadata,
                    status: 'sending',
                    timestamp: new Date().toISOString(),
                    sender: 'user'
                };

                console.log('📤 Sending message with UUID:', messageId);

                // Add to UI immediately
                set(state => {
                    const messages = state.messages.get(conversationId) || [];
                    const sendingMessages = new Map(state.sendingMessages.set(messageId, optimisticMessage));

                    return {
                        messages: new Map(state.messages.set(conversationId, [...messages, optimisticMessage])),
                        sendingMessages
                    };
                });

                try {
                    // Send via socket with callback
                    const response = await socketClient.sendMessage({
                        conversationId,
                        characterId,
                        content,
                        type,
                        metadata,
                        messageId
                    });

                    // Handle successful response - remove message from sending set
                    if (response.message) {
                        set(state => {
                            const sendingMessages = new Map(state.sendingMessages);
                            sendingMessages.delete(messageId);
                            return { sendingMessages };
                        });
                        
                        // Refresh usage for this character
                        await get().refreshCharacterUsage(characterId);
                        
                        // The real message will come via socket event, no need to manually add it
                    }
                } catch (sendError) {
                    console.error('Failed to send message:', sendError);

                    // Mark message as failed
                    set(state => {
                        const failedMessages = new Set(state.failedMessages);
                        failedMessages.add(messageId);
                        const sendingMessages = new Map(state.sendingMessages);
                        sendingMessages.delete(messageId);
                        return { failedMessages, sendingMessages };
                    });

                    // Update message status in UI
                    set(state => {
                        const messages = state.messages.get(conversationId) || [];
                        const updatedMessages = messages.map(msg =>
                            msg.id === messageId ? { ...msg, status: 'failed' } : msg
                        );

                        return {
                            messages: new Map(state.messages.set(conversationId, updatedMessages))
                        };
                    });

                    toast.error('Failed to send message');
                }

            } catch (error) {
                console.error('Failed to send message:', error);
                toast.error('Failed to send message');
            }
        },

        /**
         * Handle received message
         */
        handleMessageReceived: (data) => {
            const { conversationId, message } = data;
            
            console.log('📨 Received message:', { messageId: message.id, content: message.content.substring(0, 50) });

            set(state => {
                const messages = state.messages.get(conversationId) || [];
                const sendingMessages = new Map(state.sendingMessages);

                // Simple duplicate detection based on exact ID match only
                // Since we now use consistent UUIDs, we only need exact ID matching
                const isDuplicate = messages.some(msg => msg.id === message.id);
                
                if (isDuplicate) {
                    console.log('🚫 Duplicate message detected (exact ID match), skipping:', message.id);
                    return state; // Don't add duplicate
                }

                // Remove from sending messages if this was an optimistic update
                if (sendingMessages.has(message.id)) {
                    console.log('🔄 Confirming optimistic message:', message.id);
                    sendingMessages.delete(message.id);
                }

                let updatedMessages = messages;

                // Add new message and sort chronologically
                const beforeSort = [...updatedMessages, message];
                updatedMessages = beforeSort.sort((a, b) => {
                    const getTimestamp = (timestamp) => {
                        if (!timestamp) return 0;
                        
                        // Handle Firebase Timestamp object
                        if (timestamp._seconds) {
                            return timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000;
                        }
                        
                        // Handle ISO string or regular Date
                        return new Date(timestamp).getTime();
                    };
                    
                    return getTimestamp(a.timestamp) - getTimestamp(b.timestamp);
                });
                
                // Enhanced logging for conversation flow ordering debugging
                const sortingChanged = JSON.stringify(beforeSort.map(m => m.id)) !== JSON.stringify(updatedMessages.map(m => m.id));
                
                console.log('📝 Message ordering update:', {
                    messageId: message.id,
                    sender: message.sender,
                    timestamp: message.timestamp,
                    sortingChanged,
                    totalMessages: updatedMessages.length,
                    conversationFlowOrder: updatedMessages.map(m => ({
                        id: m.id,
                        timestamp: m.timestamp,
                        sender: m.sender,
                        content: m.content?.substring(0, 30) + '...'
                    }))
                });

                // Update queue status and clear processing states if this is an AI response
                let queueStatus = new Map(state.queueStatus);
                let llmErrorMessages = new Set(state.llmErrorMessages);
                
                if (message.sender === 'character') {
                    const currentQueueStatus = queueStatus.get(conversationId) || {};
                    queueStatus.set(conversationId, {
                        ...currentQueueStatus,
                        currentlyProcessing: null,
                        state: currentQueueStatus.queueLength > 0 ? 'queued' : 'idle'
                    });
                    
                    // Clear processing/queued status from user messages when AI responds
                    if (message.replyToMessageId) {
                        updatedMessages = updatedMessages.map(msg => {
                            if (msg.id === message.replyToMessageId) {
                                return { ...msg, status: 'delivered' };
                            }
                            return msg;
                        });
                        
                        // Remove message from LLM error set when AI responds to it
                        if (llmErrorMessages.has(message.replyToMessageId)) {
                            console.log('🎯 FRONTEND: AI response received for LLM error message:', {
                                originalMessageId: message.replyToMessageId,
                                responseMessageId: message.id,
                                conversationId
                            });
                            
                            // Find the original message to see its current state
                            const originalMessage = updatedMessages.find(msg => msg.id === message.replyToMessageId);
                            console.log('🎯 FRONTEND: Original message before clearing:', {
                                messageId: message.replyToMessageId,
                                hasLLMError: originalMessage?.hasLLMError,
                                errorType: originalMessage?.errorType,
                                isRetrying: originalMessage?.isRetrying,
                                status: originalMessage?.status
                            });
                            
                            llmErrorMessages.delete(message.replyToMessageId);
                            console.log('🎯 FRONTEND: Removed from LLM error set, clearing error fields');
                            
                            // Also clear error fields from the original message in frontend state
                            updatedMessages = updatedMessages.map(msg => {
                                if (msg.id === message.replyToMessageId) {
                                    const clearedMessage = { 
                                        ...msg, 
                                        status: 'delivered',
                                        // Clear error fields since backend cleared them too
                                        hasLLMError: undefined,
                                        errorType: undefined,
                                        errorTimestamp: undefined,
                                        originalError: undefined,
                                        isRetrying: undefined,
                                        retryAttempt: undefined,
                                        clearedAt: Date.now()
                                    };
                                    
                                    console.log('🎯 FRONTEND: Message cleared in frontend state:', {
                                        messageId: msg.id,
                                        beforeClear: {
                                            hasLLMError: msg.hasLLMError,
                                            errorType: msg.errorType,
                                            isRetrying: msg.isRetrying
                                        },
                                        afterClear: {
                                            hasLLMError: clearedMessage.hasLLMError,
                                            errorType: clearedMessage.errorType,
                                            isRetrying: clearedMessage.isRetrying,
                                            clearedAt: clearedMessage.clearedAt
                                        }
                                    });
                                    
                                    return clearedMessage;
                                }
                                return msg;
                            });
                        }
                    } else {
                        // Fallback: Clear any queued/processing messages for this conversation
                        // when AI response arrives (in case replyToMessageId is missing)
                        updatedMessages = updatedMessages.map(msg => {
                            if (msg.sender === 'user' && (msg.status === 'queued' || msg.status === 'processing')) {
                                return { ...msg, status: 'delivered' };
                            }
                            return msg;
                        });
                    }
                } else {
                    // For user messages, preserve existing queue status
                    queueStatus = new Map(state.queueStatus);
                }

                return {
                    messages: new Map(state.messages.set(conversationId, updatedMessages)),
                    sendingMessages,
                    queueStatus,
                    llmErrorMessages
                };
            });
        },

        /**
         * Handle message status updates
         */
        handleMessageStatus: (data) => {
            const { messageId, status, conversationId } = data;

            set(state => {
                const messages = state.messages.get(conversationId) || [];
                const updatedMessages = messages.map(msg =>
                    msg.id === messageId ? { ...msg, status } : msg
                );

                return {
                    messages: new Map(state.messages.set(conversationId, updatedMessages))
                };
            });
        },

        /**
         * Handle typing indicators
         */
        handleTypingIndicator: (data) => {
            const { conversationId, userId, isTyping, username } = data;

            set(state => {
                const typingUsers = new Map(state.typingUsers);
                let conversationTyping = typingUsers.get(conversationId) || new Set();

                if (isTyping) {
                    conversationTyping.add({ userId, username });
                } else {
                    conversationTyping = new Set([...conversationTyping].filter(user => user.userId !== userId));
                }

                typingUsers.set(conversationId, conversationTyping);

                return { typingUsers };
            });
        },

        /**
         * Send typing indicator
         */
        sendTyping: (conversationId, isTyping) => {
            // Fire and forget - no need to await
            if (socketClient.isConnected) {
                socketClient.sendTyping(conversationId, isTyping);
            }
        },

        /**
         * Fetch initial usage data from backend
         */
        fetchInitialUsage: async () => {
            try {
                console.log('🔄 FRONTEND DEBUG: Fetching usage data from /auth/usage...');
                const response = await apiClient.get('/auth/usage');
                console.log('📥 FRONTEND DEBUG: Raw response:', response.data);
                
                const usageData = response.data.usage;
                console.log('📊 FRONTEND DEBUG: Usage data extracted:', usageData);
                
                const characterUsageMap = new Map();

                // Store usage per character
                if (usageData && typeof usageData === 'object') {
                    console.log('🔍 FRONTEND DEBUG: Processing usage data...');
                    Object.entries(usageData).forEach(([characterId, usage]) => {
                        console.log('👤 FRONTEND DEBUG: Processing character:', {
                            characterId,
                            usage,
                            usageType: typeof usage
                        });
                        
                        if (usage && typeof usage === 'object') {
                            const characterUsage = {
                                text: { used: usage.text || 0, limit: 30 },
                                image: { used: usage.image || 0, limit: 5 },
                                audio: { used: usage.audio || 0, limit: 5 }
                            };
                            
                            console.log('✅ FRONTEND DEBUG: Setting character usage:', {
                                characterId,
                                characterUsage
                            });
                            
                            characterUsageMap.set(characterId, characterUsage);
                        }
                    });
                }

                set({ characterUsage: characterUsageMap });
                console.log('🎯 FRONTEND DEBUG: Final characterUsageMap:', characterUsageMap);
                console.log('🎯 FRONTEND DEBUG: CharacterUsageMap entries:', Array.from(characterUsageMap.entries()));
            } catch (error) {
                console.error('🚫 FRONTEND DEBUG: Failed to fetch initial usage:', error);
                // Don't show error toast for this - it's not critical for chat functionality
            }
        },

        /**
         * Get usage for specific character
         */
        getCharacterUsage: (characterId) => {
            const { characterUsage } = get();
            return characterUsage.get(characterId) || {
                text: { used: 0, limit: 30 },
                image: { used: 0, limit: 5 },
                audio: { used: 0, limit: 5 }
            };
        },

        /**
         * Update usage for specific character
         */
        updateCharacterUsage: (characterId, usage) => {
            set(state => {
                const newCharacterUsage = new Map(state.characterUsage);
                newCharacterUsage.set(characterId, usage);
                return { characterUsage: newCharacterUsage };
            });
        },

        /**
         * Refresh usage for current character after sending message
         */
        refreshCharacterUsage: async (characterId) => {
            try {
                console.log(`🔄 FRONTEND DEBUG: Refreshing usage for character ${characterId}...`);
                const response = await apiClient.get('/auth/usage');
                console.log('📥 FRONTEND DEBUG: Refresh response:', response.data);
                
                const usageData = response.data.usage;
                console.log('📊 FRONTEND DEBUG: Usage data for refresh:', usageData);
                
                if (usageData && usageData[characterId]) {
                    const usage = usageData[characterId];
                    console.log('👤 FRONTEND DEBUG: Character usage found:', {
                        characterId,
                        usage
                    });
                    
                    const updatedUsage = {
                        text: { used: usage.text || 0, limit: 30 },
                        image: { used: usage.image || 0, limit: 5 },
                        audio: { used: usage.audio || 0, limit: 5 }
                    };
                    
                    console.log('✅ FRONTEND DEBUG: Updating character usage:', {
                        characterId,
                        updatedUsage
                    });
                    
                    get().updateCharacterUsage(characterId, updatedUsage);
                } else {
                    console.log('❌ FRONTEND DEBUG: No usage data found for character:', {
                        characterId,
                        availableCharacters: Object.keys(usageData || {})
                    });
                }
            } catch (error) {
                console.error('Failed to refresh character usage:', error);
            }
        },

        /**
         * Retry failed message - for LLM errors and regular failed messages
         */
        retryMessage: async (messageId, conversationId) => {
            const { llmErrorMessages } = get();

            // Check if this is an LLM error message
            if (llmErrorMessages.has(messageId)) {
                console.log('🔄 RETRY: Initiating retry for LLM error message:', {
                    messageId,
                    conversationId,
                    hasLLMError: llmErrorMessages.has(messageId)
                });
                
                // Extract characterId from conversationId
                const parts = conversationId.split('_');
                const characterId = parts[1];
                
                if (!characterId) {
                    console.error('Invalid conversation ID format for retry');
                    return;
                }

                try {
                    // Call the custom retry WebSocket event (not sendMessage!)
                    const response = await socketClient.retryMessage(
                        conversationId,
                        messageId,
                        characterId
                    );

                    if (response.success) {
                        console.log('✅ LLM retry initiated successfully:', response);
                        
                        // Keep in LLM error set until AI actually responds
                        // (message will still be filtered from AI context for token savings)
                        
                        // Update message to show retry state (keep error fields for token filtering)
                        set(state => {
                            const messages = state.messages.get(conversationId) || [];
                            const updatedMessages = messages.map(msg => {
                                if (msg.id === messageId) {
                                    const newRetryCount = (msg.retryCount || 0) + 1;
                                    console.log('🔄 FRONTEND: Updating message retry count:', {
                                        messageId,
                                        oldRetryCount: msg.retryCount || 0,
                                        newRetryCount
                                    });
                                    
                                    return {
                                        ...msg,
                                        // Keep error fields for backend token filtering
                                        // hasLLMError: true (unchanged)
                                        // errorType: 'provider_error' (unchanged)
                                        // errorTimestamp: original timestamp (unchanged)
                                        isRetrying: true,
                                        retryAttempt: Date.now(),
                                        retryCount: newRetryCount, // Update retry count in real-time
                                        status: 'retrying'
                                    };
                                }
                                return msg;
                            });

                            return {
                                messages: new Map(state.messages.set(conversationId, updatedMessages))
                            };
                        });

                        toast.success('Message retry initiated successfully!');
                    } else {
                        // Handle specific retry limit error
                        if (response.retryLimitReached) {
                            console.log('🚫 RETRY: Max retry limit reached', {
                                retryCount: response.retryCount,
                                maxRetries: response.maxRetries
                            });
                            toast.error(`Maximum retry limit reached (${response.maxRetries} retries). This message cannot be retried again.`);
                            
                            // Remove from LLM error set so retry button disappears
                            set(state => {
                                const llmErrorMessages = new Set(state.llmErrorMessages);
                                llmErrorMessages.delete(messageId);
                                return { llmErrorMessages };
                            });
                            
                            return;
                        }
                        
                        // Handle LLM service failure during retry
                        if (response.isLLMError && response.retryFailed) {
                            console.log('🚫 RETRY: LLM service failed during retry', {
                                messageId,
                                error: response.error,
                                backendRetryCount: response.retryCount
                            });
                            toast.error('AI service is currently unavailable. The retry failed, but you can try again when the service is back online.');
                            
                            // Update message state to reflect retry failure and sync retry count with backend
                            set(state => {
                                const messages = state.messages.get(conversationId) || [];
                                const updatedMessages = messages.map(msg => {
                                    if (msg.id === messageId) {
                                        console.log('🔄 FRONTEND: Syncing retry count with backend:', {
                                            messageId,
                                            frontendRetryCount: msg.retryCount,
                                            backendRetryCount: response.retryCount,
                                            syncingTo: response.retryCount
                                        });
                                        
                                        return {
                                            ...msg,
                                            retryFailed: true,
                                            lastRetryAt: Date.now(),
                                            isRetrying: false,
                                            status: 'failed',
                                            retryCount: response.retryCount || msg.retryCount // Sync with backend
                                        };
                                    }
                                    return msg;
                                });

                                return {
                                    messages: new Map(state.messages.set(conversationId, updatedMessages))
                                };
                            });
                            
                            return;
                        }
                        
                        throw new Error(response.error || 'Retry failed');
                    }
                } catch (error) {
                    console.error('Failed to retry LLM error message:', {
                        error: error.message,
                        fullError: error,
                        messageId,
                        conversationId,
                        characterId
                    });
                    toast.error(`Failed to retry message: ${error.message}`);
                }
            } else {
                // Handle regular failed messages (old logic)
                const { sendingMessages, messages } = get();

                // Find the failed message
                const allMessages = messages.get(conversationId) || [];
                const failedMessage = allMessages.find(msg => msg.id === messageId);

                if (failedMessage) {
                    // Remove from failed set
                    set(state => ({
                        failedMessages: new Set([...state.failedMessages].filter(id => id !== messageId))
                    }));

                    // Remove the failed message from the list
                    set(state => {
                        const messages = state.messages.get(conversationId) || [];
                        const updatedMessages = messages.filter(msg => msg.id !== messageId);
                        return {
                            messages: new Map(state.messages.set(conversationId, updatedMessages))
                        };
                    });

                    // Resend the message (creates new message)
                    await get().sendMessage(
                        conversationId,
                        failedMessage.content,
                        failedMessage.type,
                        failedMessage.metadata
                    );
                }
            }
        },

        /**
         * Get messages for a conversation
         */
        getMessages: (conversationId) => {
            return get().messages.get(conversationId) || [];
        },

        /**
         * Get conversation data
         */
        getConversation: (conversationId) => {
            return get().conversations.get(conversationId);
        },

        /**
         * Get typing users for a conversation
         */
        getTypingUsers: (conversationId) => {
            return Array.from(get().typingUsers.get(conversationId) || []);
        },

        /**
         * Like/unlike a message
         */
        likeMessage: async (messageId, isLiked) => {
            const { activeConversationId } = get();
            if (!activeConversationId) {
                console.error('No active conversation');
                return;
            }

            try {
                // Update UI immediately for responsiveness
                set(state => {
                    const likedMessages = [...state.likedMessages];
                    if (isLiked) {
                        if (!likedMessages.includes(messageId)) {
                            likedMessages.push(messageId);
                        }
                    } else {
                        const index = likedMessages.indexOf(messageId);
                        if (index > -1) {
                            likedMessages.splice(index, 1);
                        }
                    }
                    return { likedMessages };
                });

                // Send to backend to persist
                await apiClient.post(`/conversations/${activeConversationId}/messages/${messageId}/like`, { 
                    isLiked 
                });
                
                console.log(`Message ${messageId} ${isLiked ? 'liked' : 'unliked'} successfully`);
            } catch (error) {
                console.error('Failed to like message:', error);
                // Revert UI change on error
                set(state => {
                    const likedMessages = [...state.likedMessages];
                    if (isLiked) {
                        const index = likedMessages.indexOf(messageId);
                        if (index > -1) {
                            likedMessages.splice(index, 1);
                        }
                    } else {
                        if (!likedMessages.includes(messageId)) {
                            likedMessages.push(messageId);
                        }
                    }
                    return { likedMessages };
                });
                
                // Show user-friendly error
                toast.error('Failed to update like status');
            }
        },

        /**
         * Check if message is liked
         */
        isMessageLiked: (messageId) => {
            return get().likedMessages.includes(messageId);
        },

        /**
         * Handle AI likes (received via WebSocket)
         */
        handleAILike: ({ messageId, likedBy, isLiked, isAILike, characterName }) => {
            console.log('🤖 handleAILike called with:', { messageId, likedBy, isLiked, isAILike });
            
            if (!isAILike) {
                console.log('❌ Not an AI like, ignoring');
                return; // Only handle AI likes here
            }
            
            console.log('✅ Processing AI like...');
            
            set(state => {
                const likedMessages = [...state.likedMessages];
                
                console.log('Current liked messages:', likedMessages);
                
                if (isLiked) {
                    if (!likedMessages.includes(messageId)) {
                        likedMessages.push(messageId);
                        console.log('➕ Added message to liked array');
                    }
                } else {
                    const index = likedMessages.indexOf(messageId);
                    if (index > -1) {
                        likedMessages.splice(index, 1);
                        console.log('➖ Removed message from liked array');
                    }
                }
                
                console.log('New liked messages:', likedMessages);
                
                return { likedMessages };
            });
            
            // Show notification when AI likes a message
            if (isLiked) {
                // Get character name from likedBy (format: ai_characterId)
                const characterId = likedBy.replace('ai_', '');
                
                // Get character name from conversations or use fallback
                const { conversations, activeConversationId } = get();
                let displayName = 'AI';
                
                if (activeConversationId && conversations.has(activeConversationId)) {
                    const conversation = conversations.get(activeConversationId);
                    displayName = characterName || conversation.characterName || 'AI';
                }
                
                toast.success(`❤️ ${displayName} liked your message!`, {
                    duration: 3000,
                    position: 'top-right',
                });
            }
            
            console.log(`🎯 AI ${isLiked ? 'liked' : 'unliked'} message ${messageId}`);
        },

        /**
         * Handle message queued event
         */
        handleMessageQueued: (data) => {
            const { messageId, queuePosition, conversationId } = data;
            
            console.log('📥 Message queued:', { messageId, queuePosition });
            
            set(state => {
                // Update message status to queued
                const messages = state.messages.get(conversationId) || [];
                const updatedMessages = messages.map(msg => {
                    if (msg.id === messageId) {
                        return { 
                            ...msg, 
                            status: 'queued', 
                            queuePosition
                        };
                    }
                    return msg;
                });

                // Update queue info
                const queueStatus = new Map(state.queueStatus);
                queueStatus.set(conversationId, {
                    ...queueStatus.get(conversationId),
                    queueLength: queuePosition,
                    hasQueuedMessages: true
                });

                return {
                    messages: new Map(state.messages.set(conversationId, updatedMessages)),
                    queueStatus
                };
            });
        },

        /**
         * Handle message processing event
         */
        handleMessageProcessing: (data) => {
            const { messageId, conversationId, processingStartedAt } = data;
            
            console.log('⚡ Message processing started:', { messageId });
            
            set(state => {
                // Update message status to processing
                const messages = state.messages.get(conversationId) || [];
                const updatedMessages = messages.map(msg => {
                    if (msg.id === messageId) {
                        return { 
                            ...msg, 
                            status: 'processing',
                            processingStartedAt 
                        };
                    }
                    return msg;
                });

                // Update queue status
                const queueStatus = new Map(state.queueStatus);
                queueStatus.set(conversationId, {
                    ...queueStatus.get(conversationId),
                    currentlyProcessing: messageId,
                    state: 'processing'
                });

                return {
                    messages: new Map(state.messages.set(conversationId, updatedMessages)),
                    queueStatus
                };
            });
        },

        /**
         * Handle queue status update
         */
        handleQueueStatus: (data) => {
            const { conversationId, queueLength, state: queueState, currentlyProcessing } = data;
            
            console.log('📊 Queue status update:', { conversationId, queueLength, queueState });
            
            set(state => {
                const queueStatus = new Map(state.queueStatus);
                queueStatus.set(conversationId, {
                    queueLength,
                    state: queueState,
                    currentlyProcessing,
                    hasQueuedMessages: queueLength > 0
                });

                return { queueStatus };
            });
        },

        /**
         * Handle message response linked event
         */
        handleMessageResponseLinked: (data) => {
            const { responseMessageId, originalMessageId, conversationId } = data;
            
            console.log('🔗 Message response linked:', { responseMessageId, originalMessageId });
            
            set(state => {
                // Store message relationship
                const messageRelationships = new Map(state.messageRelationships);
                messageRelationships.set(responseMessageId, originalMessageId);

                // Update the response message with relationship info
                const messages = state.messages.get(conversationId) || [];
                const updatedMessages = messages.map(msg => {
                    if (msg.id === responseMessageId) {
                        return { 
                            ...msg, 
                            replyToMessageId: originalMessageId,
                            isLinkedResponse: true
                        };
                    }
                    return msg;
                });

                return {
                    messageRelationships,
                    messages: new Map(state.messages.set(conversationId, updatedMessages))
                };
            });
        },

        /**
         * Handle LLM error event
         */
        handleLLMError: (data) => {
            const { conversationId, messageId, errorType, timestamp } = data;
            
            console.log('⚠️ LLM error received:', { conversationId, messageId, errorType });
            
            set(state => {
                // Add message to LLM error set
                const llmErrorMessages = new Set(state.llmErrorMessages);
                llmErrorMessages.add(messageId);

                // Update the user message to show error state
                const messages = state.messages.get(conversationId) || [];
                const updatedMessages = messages.map(msg => {
                    if (msg.id === messageId) {
                        return { 
                            ...msg, 
                            hasLLMError: true,
                            errorType,
                            errorTimestamp: timestamp
                        };
                    }
                    return msg;
                });

                return {
                    llmErrorMessages,
                    messages: new Map(state.messages.set(conversationId, updatedMessages))
                };
            });
        },

        /**
         * Get queue status for a conversation
         */
        getQueueStatus: (conversationId) => {
            const { queueStatus } = get();
            return queueStatus.get(conversationId) || {
                queueLength: 0,
                state: 'idle',
                currentlyProcessing: null,
                hasQueuedMessages: false
            };
        },

        /**
         * Get message relationship (what message this AI response is replying to)
         */
        getMessageRelationship: (messageId) => {
            const { messageRelationships } = get();
            return messageRelationships.get(messageId);
        },

        /**
         * Check if message is currently being processed
         */
        isMessageProcessing: (messageId, conversationId) => {
            const state = get();
            const queueStatus = state.getQueueStatus(conversationId);
            
            // Check if this specific message is being processed
            if (queueStatus.currentlyProcessing === messageId) {
                return true;
            }
            
            // Also check the message's own status
            const messages = state.messages.get(conversationId) || [];
            const message = messages.find(msg => msg.id === messageId);
            
            return message?.status === 'processing';
        },

        /**
         * Check if message has LLM error
         */
        hasLLMError: (messageId) => {
            return get().llmErrorMessages.has(messageId);
        },

        /**
         * Sort messages for conversation flow display
         * Simply returns chronological order - exactly when messages were written/answered
         */
        sortMessagesForConversationFlow: (chronologicalMessages) => {
            if (!chronologicalMessages || chronologicalMessages.length === 0) {
                return [];
            }

            // Just return pure chronological order - no reordering
            // This shows messages exactly in the order they were written/answered
            const sortedMessages = [...chronologicalMessages].sort((a, b) => 
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            console.log('🔄 Pure chronological order applied:', {
                totalMessages: sortedMessages.length,
                chronologicalFlow: sortedMessages.map((m, index) => ({
                    index,
                    sender: m.sender,
                    content: m.content?.substring(0, 40) + '...',
                    timestamp: m.timestamp,
                    timestampReadable: new Date(m.timestamp?._seconds ? m.timestamp._seconds * 1000 : m.timestamp).toISOString()
                }))
            });

            return sortedMessages;
        },

        /**
         * Cleanup when unmounting
         */
        cleanup: () => {
            // Remove all event listeners
            socketClient.off('connected');
            socketClient.off('disconnected');
            socketClient.off('error');
            socketClient.off('max_reconnect_reached');
            socketClient.off('message:receive');
            socketClient.off('message:status');
            socketClient.off('message:liked');
            socketClient.off('typing:indicator');
            socketClient.off('usage:update');
            
            // Remove natural queuing system event listeners
            socketClient.off('message:queued');
            socketClient.off('message:processing');
            socketClient.off('queue:status');
            socketClient.off('message:response_linked');
            
            // Remove LLM error event listeners
            socketClient.off('message:llm_error');
            
            // Disconnect socket
            socketClient.disconnect();
            
            // Reset state
            set({
                isConnected: false,
                isConnecting: false,
                activeConversationId: null,
                connectionError: null,
                conversations: new Map(),
                messages: new Map(),
                sendingMessages: new Map(),
                failedMessages: new Set(),
                likedMessages: [],
                llmErrorMessages: new Set(),
                messageQueues: new Map(),
                queueStatus: new Map(),
                messageRelationships: new Map(),
                typingUsers: new Map(),
                characterUsage: new Map()
            });
        }
    }))
);

export default useChatStore;