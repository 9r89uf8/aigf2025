/**
 * Message Slice
 * Manages message state and operations
 */
import socketClient from '../../../lib/socket/client';
import { apiClient } from '../../../lib/api/client';
import { generateMessageId } from '../../../lib/utils/generateId';
import toast from 'react-hot-toast';
import { sortMessagesForConversationFlow } from '../utils/messageUtils';

export const createMessageSlice = (set, get) => ({
    // Messages state
    messages: new Map(), // conversationId -> messages array
    sendingMessages: new Map(), // temporary messages being sent
    failedMessages: new Set(), // failed message IDs
    llmErrorMessages: new Set(), // message IDs with LLM errors

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
            const isDuplicate = messages.some(msg => msg.id === message.id);
            
            if (isDuplicate) {
                console.log('🚫 Duplicate message detected (exact ID match), skipping:', message.id);
                return state;
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
                        
                        llmErrorMessages.delete(message.replyToMessageId);
                        
                        // Clear error fields from the original message
                        updatedMessages = updatedMessages.map(msg => {
                            if (msg.id === message.replyToMessageId) {
                                return { 
                                    ...msg, 
                                    status: 'delivered',
                                    hasLLMError: undefined,
                                    errorType: undefined,
                                    errorTimestamp: undefined,
                                    originalError: undefined,
                                    isRetrying: undefined,
                                    retryAttempt: undefined,
                                    clearedAt: Date.now()
                                };
                            }
                            return msg;
                        });
                    }
                } else {
                    // Fallback: Clear any queued/processing messages
                    updatedMessages = updatedMessages.map(msg => {
                        if (msg.sender === 'user' && (msg.status === 'queued' || msg.status === 'processing')) {
                            return { ...msg, status: 'delivered' };
                        }
                        return msg;
                    });
                }
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
     * Check if message has LLM error
     */
    hasLLMError: (messageId) => {
        return get().llmErrorMessages.has(messageId);
    },

    /**
     * Get messages for a conversation
     */
    getMessages: (conversationId) => {
        return get().messages.get(conversationId) || [];
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
                                    isRetrying: true,
                                    retryAttempt: Date.now(),
                                    retryCount: newRetryCount,
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
                                        retryCount: response.retryCount || msg.retryCount
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
     * Sort messages for conversation flow display
     */
    sortMessagesForConversationFlow: sortMessagesForConversationFlow
});