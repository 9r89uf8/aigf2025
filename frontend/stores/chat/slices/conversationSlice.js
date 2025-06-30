/**
 * Conversation Slice
 * Manages conversation state and operations
 */
import socketClient from '../../../lib/socket/client';
import { apiClient } from '../../../lib/api/client';
import toast from 'react-hot-toast';

export const createConversationSlice = (set, get) => ({
    // Conversations state
    conversations: new Map(),
    activeConversationId: null,

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
     * Get conversation data
     */
    getConversation: (conversationId) => {
        return get().conversations.get(conversationId);
    }
});