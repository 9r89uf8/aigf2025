# Conversation State Service API Reference

## Table of Contents

- [Constants](#constants)
- [State Management](#state-management)
- [Queue Management](#queue-management)
- [Processing Management](#processing-management)
- [Cleanup Management](#cleanup-management)
- [Status Management](#status-management)
- [Utility Functions](#utility-functions)

## Constants

### CONVERSATION_STATES
```javascript
const CONVERSATION_STATES = {
  IDLE: 'idle',              // No active processing
  PROCESSING: 'processing',   // Currently processing a message
  QUEUED: 'queued'           // Has messages waiting in queue
}
```

### QUEUE_CONFIG
```javascript
const QUEUE_CONFIG = {
  MAX_QUEUE_SIZE: 10,        // Maximum messages per queue
  MESSAGE_TTL: 300,          // Message TTL in seconds (5 min)
  PROCESSING_TIMEOUT: 120,   // Processing timeout (2 min)
  CLEANUP_INTERVAL: 60       // Cleanup interval (1 min)
}
```

## State Management

### getConversationState(conversationId)
Retrieves the current state of a conversation.

**Parameters:**
- `conversationId` (string): Format: `userId_characterId`

**Returns:** `Promise<Object>`
```javascript
{
  conversationId: "user123_char456",
  state: "idle",
  messageQueue: [],
  currentlyProcessing: null,
  lastProcessedAt: "2025-01-27T10:00:00Z",
  processingStartedAt: null,
  createdAt: "2025-01-27T09:00:00Z",
  updatedAt: "2025-01-27T10:00:00Z"
}
```

**Example:**
```javascript
const state = await getConversationState('user123_char456');
console.log(`Current state: ${state.state}`);
```

### setConversationState(conversationId, state)
Updates the conversation state in Redis.

**Parameters:**
- `conversationId` (string): Conversation identifier
- `state` (Object): Complete state object

**Returns:** `Promise<void>`

**Example:**
```javascript
const updatedState = {
  ...currentState,
  state: CONVERSATION_STATES.PROCESSING
};
await setConversationState('user123_char456', updatedState);
```

## Queue Management

### addMessageToQueue(conversationId, messageData)
Adds a message to the conversation queue.

**Parameters:**
- `conversationId` (string): Conversation identifier
- `messageData` (Object): Message to queue
  - `messageId` (string): Unique message ID
  - `userId` (string): User ID
  - `characterId` (string): Character ID
  - `messageData` (Object): Message content
  - `originalTimestamp` (number): Original receive timestamp
  - `tempId` (string, optional): Temporary client ID

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  queuePosition: 3,
  queueLength: 3,
  state: "queued"
}
```

**Throws:**
- Error if queue is full (MAX_QUEUE_SIZE exceeded)

**Example:**
```javascript
try {
  const result = await addMessageToQueue('user123_char456', {
    messageId: 'msg_789',
    userId: 'user123',
    characterId: 'char456',
    messageData: { content: 'Hello', type: 'text' },
    originalTimestamp: Date.now(),
    tempId: 'temp_123'
  });
  console.log(`Queued at position ${result.queuePosition}`);
} catch (error) {
  if (error.message.includes('Queue full')) {
    console.error('Cannot queue - limit reached');
  }
}
```

### getNextQueuedMessage(conversationId)
Retrieves the next message from the queue (FIFO).

**Parameters:**
- `conversationId` (string): Conversation identifier

**Returns:** `Promise<Object|null>`
```javascript
{
  messageId: "msg_789",
  userId: "user123",
  characterId: "char456",
  messageData: { content: "Hello", type: "text" },
  queuedAt: "2025-01-27T10:00:00Z",
  originalTimestamp: 1706352000000,
  tempId: "temp_123"
}
```

**Note:** Automatically removes expired messages

**Example:**
```javascript
const nextMessage = await getNextQueuedMessage('user123_char456');
if (nextMessage) {
  console.log(`Processing message: ${nextMessage.messageId}`);
  // Process the message...
}
```

### removeMessageFromQueue(conversationId, messageId)
Removes a processed message from the queue.

**Parameters:**
- `conversationId` (string): Conversation identifier
- `messageId` (string): Message ID to remove

**Returns:** `Promise<Object>`
```javascript
{
  queueLength: 2,
  hasMore: true,
  state: "queued"
}
```

**Example:**
```javascript
const result = await removeMessageFromQueue('user123_char456', 'msg_789');
if (result.hasMore) {
  // Process next message
}
```

## Processing Management

### setConversationProcessing(conversationId, messageId)
Sets conversation to processing state.

**Parameters:**
- `conversationId` (string): Conversation identifier
- `messageId` (string): Message being processed

**Returns:** `Promise<void>`

**Example:**
```javascript
await setConversationProcessing('user123_char456', 'msg_789');
// Message is now being processed
```

### resetConversationProcessing(conversationId)
Resets conversation from processing state.

**Parameters:**
- `conversationId` (string): Conversation identifier

**Returns:** `Promise<void>`

**Example:**
```javascript
// Use when processing fails or times out
await resetConversationProcessing('user123_char456');
```

### canProcessImmediately(conversationId)
Checks if a conversation can process a new message immediately.

**Parameters:**
- `conversationId` (string): Conversation identifier

**Returns:** `Promise<boolean>`

**Example:**
```javascript
if (await canProcessImmediately('user123_char456')) {
  // Process directly
} else {
  // Must queue the message
}
```

### completeMessageProcessing(conversationId, messageId)
Marks message processing as complete.

**Parameters:**
- `conversationId` (string): Conversation identifier
- `messageId` (string): Completed message ID

**Returns:** `Promise<void>`

**Example:**
```javascript
await setConversationProcessing(conversationId, messageId);
// ... process message ...
await completeMessageProcessing(conversationId, messageId);
```

## Cleanup Management

### cleanupExpiredMessages()
Removes expired messages from all conversation queues.

**Parameters:** None

**Returns:** `Promise<Object>`
```javascript
{
  cleanedCount: 15,
  conversationsProcessed: 100,
  totalConversations: 120,
  errors: []
}
```

**Example:**
```javascript
const stats = await cleanupExpiredMessages();
console.log(`Cleaned ${stats.cleanedCount} expired messages`);
```

### initializeCleanup()
Starts automatic cleanup interval.

**Parameters:** None

**Returns:** `void`

**Example:**
```javascript
// Call once on application startup
initializeCleanup();
```

### stopCleanup()
Stops the cleanup interval.

**Parameters:** None

**Returns:** `void`

**Example:**
```javascript
// Call on application shutdown
stopCleanup();
```

### cleanupConversation(conversationId)
Manually cleanup a specific conversation.

**Parameters:**
- `conversationId` (string): Conversation identifier

**Returns:** `Promise<Object>`
```javascript
{
  cleaned: 3  // Number of messages removed
}
```

**Example:**
```javascript
const result = await cleanupConversation('user123_char456');
console.log(`Removed ${result.cleaned} expired messages`);
```

## Status Management

### getQueueStatus(conversationId)
Gets detailed queue status for a conversation.

**Parameters:**
- `conversationId` (string): Conversation identifier

**Returns:** `Promise<Object>`
```javascript
{
  conversationId: "user123_char456",
  state: "queued",
  queueLength: 3,
  currentlyProcessing: null,
  processingStartedAt: null,
  lastProcessedAt: "2025-01-27T09:55:00Z",
  queuedMessages: [
    {
      messageId: "msg_123",
      queuedAt: "2025-01-27T10:00:00Z",
      tempId: "temp_123"
    }
  ],
  processingDuration: 45000  // If processing
}
```

**Example:**
```javascript
const status = await getQueueStatus('user123_char456');
console.log(`Queue has ${status.queueLength} messages`);
```

### getAllConversationStates()
Retrieves all conversation states for monitoring.

**Parameters:** None

**Returns:** `Promise<Array<Object>>`
```javascript
[
  {
    conversationId: "user123_char456",
    state: "idle",
    queueLength: 0,
    currentlyProcessing: null,
    createdAt: "2025-01-27T09:00:00Z",
    updatedAt: "2025-01-27T10:00:00Z",
    lastProcessedAt: "2025-01-27T09:55:00Z",
    processingDuration: "0s",
    isStuck: false,
    oldestMessageAge: "0s"
  }
]
```

**Example:**
```javascript
const allStates = await getAllConversationStates();
const activeConversations = allStates.filter(s => s.state !== 'idle');
```

### getConversationStats()
Gets aggregate statistics across all conversations.

**Parameters:** None

**Returns:** `Promise<Object>`
```javascript
{
  totalConversations: 150,
  byState: {
    idle: 120,
    processing: 10,
    queued: 20
  },
  totalQueuedMessages: 45,
  averageQueueLength: 0.3,
  longestQueue: 8,
  stuckProcessing: 2
}
```

**Example:**
```javascript
const stats = await getConversationStats();
console.log(`${stats.stuckProcessing} conversations may be stuck`);
```

## Utility Functions

### utils.formatConversationId(userId, characterId)
Creates a conversation ID from components.

**Parameters:**
- `userId` (string): User ID
- `characterId` (string): Character ID

**Returns:** `string`

**Example:**
```javascript
const convId = utils.formatConversationId('user123', 'char456');
// Returns: "user123_char456"
```

### utils.parseConversationId(conversationId)
Parses conversation ID into components.

**Parameters:**
- `conversationId` (string): Conversation ID

**Returns:** `Object`
```javascript
{
  userId: "user123",
  characterId: "char456"
}
```

**Example:**
```javascript
const { userId, characterId } = utils.parseConversationId('user123_char456');
```

### utils.getMessageAge(timestamp)
Calculates message age in seconds.

**Parameters:**
- `timestamp` (string): ISO timestamp

**Returns:** `number`

**Example:**
```javascript
const ageInSeconds = utils.getMessageAge('2025-01-27T10:00:00Z');
```

### utils.formatDuration(milliseconds)
Formats duration for human readability.

**Parameters:**
- `milliseconds` (number): Duration in milliseconds

**Returns:** `string`

**Example:**
```javascript
const formatted = utils.formatDuration(125000);
// Returns: "2m 5s"
```

### utils.createErrorResponse(message, code, details)
Creates standardized error response.

**Parameters:**
- `message` (string): Error message
- `code` (string, optional): Error code (default: 'UNKNOWN_ERROR')
- `details` (Object, optional): Additional details

**Returns:** `Object`
```javascript
{
  success: false,
  error: {
    message: "Queue full",
    code: "QUEUE_FULL",
    details: { maxSize: 10 },
    timestamp: "2025-01-27T10:00:00Z"
  }
}
```

**Example:**
```javascript
const error = utils.createErrorResponse(
  'Queue full',
  'QUEUE_FULL',
  { maxSize: 10, currentSize: 10 }
);
```

## Error Codes

Common error codes returned by the service:

- `QUEUE_FULL`: Queue has reached MAX_QUEUE_SIZE
- `REDIS_ERROR`: Redis connection or operation failed
- `INVALID_STATE`: State data is corrupted or invalid
- `PROCESSING_TIMEOUT`: Message processing exceeded timeout
- `NOT_FOUND`: Conversation or message not found

## Best Practices

1. **Always check `canProcessImmediately()` before processing**
2. **Handle queue full errors gracefully**
3. **Call `completeMessageProcessing()` after processing**
4. **Initialize cleanup on startup**
5. **Monitor stuck processes with `getConversationStats()`**
6. **Use appropriate error handling for all operations**