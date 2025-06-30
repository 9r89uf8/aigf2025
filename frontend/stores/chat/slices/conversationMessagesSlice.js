/**
 * Conversation Messages Slice
 * Manages loading and retrieving messages for conversations
 */
import socketClient from '../../../lib/socket/client';
import { apiClient } from '../../../lib/api/client';
import toast from 'react-hot-toast';

export const createConversationMessagesSlice = (set, get) => ({
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
            const { user } = await import('../../authStore.js').then(m => m.default.getState());
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
    }
});