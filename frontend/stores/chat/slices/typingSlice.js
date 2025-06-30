/**
 * Typing Slice
 * Manages typing indicators
 */
import socketClient from '../../../lib/socket/client';

export const createTypingSlice = (set, get) => ({
    // Typing indicators state
    typingUsers: new Map(), // conversationId -> Set of typing users

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
     * Get typing users for a conversation
     */
    getTypingUsers: (conversationId) => {
        return Array.from(get().typingUsers.get(conversationId) || []);
    }
});