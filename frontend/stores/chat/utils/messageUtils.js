/**
 * Message Utilities
 * Helper functions for message operations
 */

/**
 * Sort messages for conversation flow display
 * Simply returns chronological order - exactly when messages were written/answered
 */
export const sortMessagesForConversationFlow = (chronologicalMessages) => {
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
};

/**
 * Get timestamp value from various timestamp formats
 */
export const getTimestamp = (timestamp) => {
    if (!timestamp) return 0;
    
    // Handle Firebase Timestamp object
    if (timestamp._seconds) {
        return timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000;
    }
    
    // Handle ISO string or regular Date
    return new Date(timestamp).getTime();
};