/**
 * Socket Slice
 * Manages WebSocket connection state and initialization
 */
import socketClient from '../../../lib/socket/client';
import toast from 'react-hot-toast';
import { setupSocketEventHandlers } from '../handlers/socketEventHandlers';

export const createSocketSlice = (set, get) => ({
    // Connection state
    isConnected: false,
    isConnecting: false,
    connectionError: null,

    /**
     * Set connection status (used by socket event handlers)
     */
    setConnectionStatus: (status) => {
        set(status);
    },

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
            setupSocketEventHandlers(socketClient, get);

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
     * Cleanup when unmounting
     */
    cleanup: () => {
        // Remove all event listeners
        const eventTypes = [
            'connected', 'disconnected', 'error', 'max_reconnect_reached', 
            'message:receive', 'message:status', 'message:liked', 'typing:indicator', 'usage:update',
            'message:queued', 'message:processing', 'queue:status', 'message:response_linked',
            'message:llm_error'
        ];
        
        eventTypes.forEach(event => {
            socketClient.off(event);
        });
        
        // Disconnect socket
        socketClient.disconnect();
        
        // Reset all state
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
});