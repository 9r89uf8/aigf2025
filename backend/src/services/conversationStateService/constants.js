/**
 * Constants for Conversation State Service
 * Defines states, configuration, and limits for conversation management
 */

/**
 * Possible states for a conversation
 */
export const CONVERSATION_STATES = {
  IDLE: 'idle',              // No active processing, ready for new messages
  PROCESSING: 'processing',   // Currently processing a message
  QUEUED: 'queued'           // Has messages waiting in queue
};

/**
 * Queue configuration parameters
 */
export const QUEUE_CONFIG = {
  MAX_QUEUE_SIZE: 10,        // Maximum messages allowed in queue per conversation
  MESSAGE_TTL: 300,          // Message time-to-live in seconds (5 minutes)
  PROCESSING_TIMEOUT: 120,   // Processing timeout in seconds (2 minutes)
  CLEANUP_INTERVAL: 60       // Cleanup interval in seconds (1 minute)
};

/**
 * Redis key prefixes
 */
export const REDIS_KEYS = {
  CONVERSATION_STATE: 'conversation_state:',
  CONVERSATION_STATE_PATTERN: 'conversation_state:*'
};

export default {
  CONVERSATION_STATES,
  QUEUE_CONFIG,
  REDIS_KEYS
};