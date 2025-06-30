/**
 * Message Likes Slice
 * Manages message like functionality
 */
import { apiClient } from '../../../lib/api/client';
import toast from 'react-hot-toast';

export const createMessageLikesSlice = (set, get) => ({
    // Liked messages state
    likedMessages: [], // liked message IDs array

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
    }
});