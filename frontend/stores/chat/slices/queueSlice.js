/**
 * Queue Slice
 * Manages message queuing and processing state
 */

export const createQueueSlice = (set, get) => ({
    // Natural Message Queuing System state
    messageQueues: new Map(), // conversationId -> queue state
    queueStatus: new Map(), // conversationId -> { state, queueLength, processing }
    messageRelationships: new Map(), // responseMessageId -> originalMessageId

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
    }
});