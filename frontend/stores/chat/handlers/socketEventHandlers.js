/**
 * Socket Event Handlers
 * Centralized handling of all WebSocket events
 */
import toast from 'react-hot-toast';

export const setupSocketEventHandlers = (socketClient, get) => {
    // Clear any existing listeners first
    const eventTypes = [
        'connected', 'disconnected', 'error', 'max_reconnect_reached', 
        'message:receive', 'message:status', 'message:liked', 'typing:indicator', 'usage:update',
        'message:queued', 'message:processing', 'queue:status', 'message:response_linked',
        'message:llm_error'
    ];
    
    eventTypes.forEach(event => {
        socketClient.off(event);
    });

    // Connection events
    socketClient.on('connected', () => {
        console.log('Socket connected successfully');
        get().setConnectionStatus({ isConnected: true, connectionError: null });
    });

    socketClient.on('disconnected', ({ reason }) => {
        console.log('Socket disconnected:', reason);
        get().setConnectionStatus({ isConnected: false });
        // Don't show error for intentional disconnects
        if (reason !== 'io client disconnect') {
            toast.error('Connection lost. Reconnecting...');
        }
    });

    socketClient.on('error', ({ error }) => {
        console.error('Socket error:', error);
        get().setConnectionStatus({ connectionError: error });
        if (!error.includes('auth')) {
            toast.error('Connection error');
        }
    });

    socketClient.on('max_reconnect_reached', () => {
        console.error('Maximum reconnection attempts reached');
        get().setConnectionStatus({ connectionError: 'Unable to reconnect. Please refresh the page.' });
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
        console.log('🎯 USAGE UPDATE EVENT RECEIVED:', {
            data,
            timestamp: new Date().toISOString(),
            characterId: data.characterId,
            usage: data.usage,
            currentStoreState: get().characterUsage.get(data.characterId)
        });
        
        get().updateUsage(data);
        
        // Verify update worked
        setTimeout(() => {
            console.log('🎯 USAGE AFTER UPDATE:', {
                characterId: data.characterId,
                newStoreState: get().characterUsage.get(data.characterId)
            });
        }, 100);
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
};