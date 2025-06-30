# Chat Store Documentation

## Overview

The Chat Store is a modular Zustand store that manages all real-time messaging functionality in the frontend. It handles WebSocket connections, message management, conversations, typing indicators, usage tracking, and more.

## Architecture

The store is split into multiple slices following the separation of concerns principle:

```
chat/
├── index.js                    # Main export point
├── store.js                    # Combines all slices
├── slices/                     # Individual store slices
│   ├── socketSlice.js          # WebSocket connection
│   ├── messageSlice.js         # Message operations
│   ├── messageLikesSlice.js    # Like functionality
│   ├── conversationSlice.js    # Conversation management
│   ├── conversationMessagesSlice.js # Message loading
│   ├── queueSlice.js           # Message queue state
│   ├── usageSlice.js           # Usage tracking
│   └── typingSlice.js          # Typing indicators
├── handlers/                   # Event handlers
│   └── socketEventHandlers.js  # Socket.io events
└── utils/                      # Utilities
    └── messageUtils.js         # Message helpers
```

## Core Concepts

### 1. **State Management**
- Uses Zustand with `subscribeWithSelector` middleware
- Each slice manages its own state domain
- State is combined in `store.js`

### 2. **WebSocket Integration**
- Real-time communication via Socket.io
- Automatic reconnection handling
- Event-driven architecture

### 3. **Optimistic Updates**
- Messages appear instantly in UI
- Confirmed/updated when server responds
- Failed messages can be retried

## Slice Responsibilities

### socketSlice.js
**Purpose**: Manages WebSocket connection lifecycle

**State**:
- `isConnected`: Current connection status
- `isConnecting`: Connection in progress flag
- `connectionError`: Error message if connection fails

**Key Methods**:
- `initialize()`: Connect to WebSocket and set up listeners
- `cleanup()`: Disconnect and reset all state
- `setConnectionStatus()`: Update connection state

### messageSlice.js
**Purpose**: Core message operations and state

**State**:
- `messages`: Map of conversationId -> message arrays
- `sendingMessages`: Temporary messages being sent
- `failedMessages`: Set of failed message IDs
- `llmErrorMessages`: Set of messages with AI errors

**Key Methods**:
- `sendMessage()`: Send new message with optimistic update
- `handleMessageReceived()`: Process incoming messages
- `handleMessageStatus()`: Update message delivery status
- `retryMessage()`: Retry failed or LLM error messages
- `handleLLMError()`: Mark messages with AI processing errors

### messageLikesSlice.js
**Purpose**: Handle message like/unlike functionality

**State**:
- `likedMessages`: Array of liked message IDs

**Key Methods**:
- `likeMessage()`: Like/unlike a message
- `isMessageLiked()`: Check if message is liked
- `handleAILike()`: Process AI character likes

### conversationSlice.js
**Purpose**: Manage conversations and active state

**State**:
- `conversations`: Map of conversation data
- `activeConversationId`: Currently active conversation

**Key Methods**:
- `joinConversation()`: Join and load conversation
- `leaveConversation()`: Leave current conversation
- `loadConversation()`: Fetch conversation data
- `createConversation()`: Create new conversation

### conversationMessagesSlice.js
**Purpose**: Handle message loading and pagination

**Key Methods**:
- `loadMessages()`: Load messages with pagination support
- Handles both WebSocket and API fallback
- Extracts liked messages and LLM errors

### queueSlice.js
**Purpose**: Track message processing queue

**State**:
- `messageQueues`: Queue state per conversation
- `queueStatus`: Processing status info
- `messageRelationships`: Links AI responses to user messages

**Key Methods**:
- `handleMessageQueued()`: Update when message enters queue
- `handleMessageProcessing()`: Mark message as processing
- `handleQueueStatus()`: Update overall queue state
- `getQueueStatus()`: Get queue info for conversation

### usageSlice.js
**Purpose**: Track usage limits per character

**State**:
- `characterUsage`: Map of character usage stats

**Key Methods**:
- `fetchInitialUsage()`: Load usage from backend
- `getCharacterUsage()`: Get usage for specific character
- `updateCharacterUsage()`: Update usage stats
- `refreshCharacterUsage()`: Refresh after sending message

### typingSlice.js
**Purpose**: Manage typing indicators

**State**:
- `typingUsers`: Map of users typing in each conversation

**Key Methods**:
- `handleTypingIndicator()`: Update typing state
- `sendTyping()`: Send typing status
- `getTypingUsers()`: Get typing users for conversation

## Data Flow

### Message Send Flow
```
User types message
    ↓
sendMessage() called
    ↓
1. Check usage limits
2. Create optimistic message
3. Add to UI immediately
4. Send via WebSocket
    ↓
Server processes
    ↓
message:receive event
    ↓
handleMessageReceived()
    ↓
Update UI with confirmed message
```

### Message Receive Flow
```
AI generates response
    ↓
Server sends via WebSocket
    ↓
message:receive event
    ↓
handleMessageReceived()
    ↓
1. Check for duplicates
2. Sort chronologically
3. Update queue status
4. Clear LLM errors if resolved
5. Update UI
```

### Connection Flow
```
initialize() called
    ↓
1. Connect to WebSocket
2. Set up event listeners
3. Fetch initial usage
4. Set connected status
    ↓
On disconnect:
    ↓
1. Show reconnecting toast
2. Attempt reconnection
3. Rejoin active conversation
```

### LLM Error Retry Flow
```
LLM service fails
    ↓
message:llm_error event
    ↓
handleLLMError()
    ↓
Message marked with error
    ↓
User clicks retry
    ↓
retryMessage() called
    ↓
1. Check retry limit
2. Send retry request
3. Update UI state
4. Wait for AI response
```

## Event Handlers

### Socket Events Handled
- **Connection**: `connected`, `disconnected`, `error`, `max_reconnect_reached`
- **Messages**: `message:receive`, `message:status`, `message:liked`
- **Queue**: `message:queued`, `message:processing`, `queue:status`, `message:response_linked`
- **Errors**: `message:llm_error`
- **Typing**: `typing:indicator`
- **Usage**: `usage:update`

## Usage Patterns

### Accessing the Store
```javascript
import useChatStore from '@/stores/chatStore';

// In component
const { 
  messages, 
  sendMessage, 
  isConnected 
} = useChatStore();
```

### Subscribing to Changes
```javascript
// Subscribe to specific state changes
useEffect(() => {
  const unsubscribe = useChatStore.subscribe(
    state => state.messages.get(conversationId),
    messages => {
      // Handle message updates
    }
  );
  return unsubscribe;
}, [conversationId]);
```

### Common Operations
```javascript
// Send a message
await sendMessage(conversationId, 'Hello!', 'text');

// Check if connected
if (isConnected) {
  // Perform real-time operations
}

// Like a message
await likeMessage(messageId, true);

// Retry failed message
await retryMessage(messageId, conversationId);
```

## Error Handling

1. **Connection Errors**: Shown as toasts, stored in `connectionError`
2. **Message Failures**: Added to `failedMessages` set, can be retried
3. **LLM Errors**: Special handling with retry limits and UI indicators
4. **Usage Limits**: Prevented at send time with user-friendly messages

## Performance Considerations

1. **Message Deduplication**: Prevents duplicate messages by ID
2. **Optimistic Updates**: Instant UI feedback
3. **Chronological Sorting**: Maintains message order
4. **Map/Set Usage**: Efficient lookups and updates
5. **Selective Re-renders**: Zustand's subscribeWithSelector

## Testing Considerations

When testing the chat store:

1. **Mock Socket.io**: Use socket.io-mock for unit tests
2. **Test Each Slice**: Slices can be tested independently
3. **Integration Tests**: Test slice interactions
4. **Error Scenarios**: Test connection failures, retries
5. **State Consistency**: Verify state updates correctly

## Debugging Tips

1. **Enable Zustand DevTools**: 
   ```javascript
   import { devtools } from 'zustand/middleware'
   ```

2. **Log State Changes**:
   ```javascript
   useChatStore.subscribe(console.log)
   ```

3. **Check Socket Connection**:
   ```javascript
   const { isConnected, connectionError } = useChatStore.getState()
   ```

4. **Monitor Events**: Socket events are logged to console

## Future Enhancements

1. **Message Persistence**: Add offline support
2. **Pagination**: Implement virtual scrolling
3. **Search**: Add message search functionality
4. **Attachments**: Enhance media handling
5. **Read Receipts**: Add read status tracking