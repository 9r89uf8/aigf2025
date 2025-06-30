# Chat Store Quick Reference

## Common Tasks

### Initialize Chat
```javascript
// In your main chat component
useEffect(() => {
  useChatStore.getState().initialize();
  return () => useChatStore.getState().cleanup();
}, []);
```

### Send a Message
```javascript
const { sendMessage } = useChatStore();
await sendMessage(conversationId, content, type, metadata);
// Types: 'text', 'image', 'audio'
```

### Get Messages
```javascript
const messages = useChatStore(state => state.messages.get(conversationId) || []);
```

### Join Conversation
```javascript
const { joinConversation } = useChatStore();
await joinConversation(conversationId, characterId);
```

### Like a Message
```javascript
const { likeMessage, isMessageLiked } = useChatStore();
const isLiked = isMessageLiked(messageId);
await likeMessage(messageId, !isLiked);
```

### Retry Failed Message
```javascript
const { retryMessage, hasLLMError } = useChatStore();
if (hasLLMError(messageId)) {
  await retryMessage(messageId, conversationId);
}
```

### Check Connection
```javascript
const isConnected = useChatStore(state => state.isConnected);
const connectionError = useChatStore(state => state.connectionError);
```

### Get Usage for Character
```javascript
const { getCharacterUsage } = useChatStore();
const usage = getCharacterUsage(characterId);
// Returns: { text: {used, limit}, image: {used, limit}, audio: {used, limit} }
```

### Send Typing Indicator
```javascript
const { sendTyping } = useChatStore();
sendTyping(conversationId, true); // Start typing
sendTyping(conversationId, false); // Stop typing
```

### Get Queue Status
```javascript
const { getQueueStatus } = useChatStore();
const status = getQueueStatus(conversationId);
// Returns: { queueLength, state, currentlyProcessing, hasQueuedMessages }
```

## State Structure

### Core State
```javascript
{
  // Connection
  isConnected: boolean,
  isConnecting: boolean,
  connectionError: string | null,
  
  // Conversations
  conversations: Map<conversationId, conversationData>,
  activeConversationId: string | null,
  
  // Messages
  messages: Map<conversationId, Message[]>,
  sendingMessages: Map<messageId, temporaryMessage>,
  failedMessages: Set<messageId>,
  likedMessages: string[],
  llmErrorMessages: Set<messageId>,
  
  // Queue
  messageQueues: Map<conversationId, queueState>,
  queueStatus: Map<conversationId, statusInfo>,
  messageRelationships: Map<responseId, originalId>,
  
  // Typing
  typingUsers: Map<conversationId, Set<typingUser>>,
  
  // Usage
  characterUsage: Map<characterId, usageInfo>
}
```

### Message Structure
```javascript
{
  id: string,
  content: string,
  type: 'text' | 'image' | 'audio',
  sender: 'user' | 'character',
  timestamp: Date | string,
  status: 'sending' | 'queued' | 'processing' | 'delivered' | 'failed',
  metadata: object,
  likes: { [userId]: boolean },
  replyToMessageId?: string,
  hasLLMError?: boolean,
  errorType?: string,
  retryCount?: number
}
```

## WebSocket Events

### Incoming Events
- `connected` - Socket connected
- `disconnected` - Socket disconnected
- `message:receive` - New message received
- `message:status` - Message status update
- `message:liked` - Message liked by AI
- `message:queued` - Message entered queue
- `message:processing` - Message being processed
- `message:llm_error` - AI processing failed
- `typing:indicator` - Someone typing
- `usage:update` - Usage stats updated
- `queue:status` - Queue state changed

### Outgoing Events
- `message:send` - Send new message
- `conversation:join` - Join conversation room
- `conversation:leave` - Leave conversation room
- `typing:send` - Send typing status
- `message:retry` - Retry failed message

## Error Handling

### Connection Errors
```javascript
if (!isConnected && connectionError) {
  // Show reconnection UI
}
```

### Message Errors
```javascript
const hasFailed = failedMessages.has(messageId);
const hasLLMError = llmErrorMessages.has(messageId);

if (hasFailed || hasLLMError) {
  // Show retry button
}
```

### Usage Limits
```javascript
const usage = getCharacterUsage(characterId);
if (usage.text.used >= usage.text.limit) {
  // Show upgrade prompt
}
```

## Performance Tips

1. **Subscribe to specific conversation messages**:
   ```javascript
   const messages = useChatStore(
     state => state.messages.get(conversationId) || []
   );
   ```

2. **Use shallow comparison for arrays**:
   ```javascript
   const messages = useChatStore(
     state => state.messages.get(conversationId),
     shallow
   );
   ```

3. **Batch state reads**:
   ```javascript
   const { sendMessage, isConnected, activeConversationId } = useChatStore();
   ```

4. **Avoid subscribing to entire store**:
   ```javascript
   // ❌ Bad
   const state = useChatStore();
   
   // ✅ Good
   const messages = useChatStore(state => state.messages);
   ```

## Debugging

### Check Store State
```javascript
console.log(useChatStore.getState());
```

### Monitor State Changes
```javascript
const unsubscribe = useChatStore.subscribe(
  state => console.log('State changed:', state)
);
```

### Check Specific Slice
```javascript
const { messages, queueStatus, characterUsage } = useChatStore.getState();
console.log({ messages, queueStatus, characterUsage });
```

### Socket Connection Status
```javascript
const { isConnected, connectionError } = useChatStore.getState();
console.log('Socket status:', { isConnected, connectionError });
```

## Common Patterns

### Loading State
```javascript
const isLoading = useChatStore(state => 
  state.isConnecting || !state.messages.has(conversationId)
);
```

### Message Count
```javascript
const messageCount = useChatStore(state => 
  (state.messages.get(conversationId) || []).length
);
```

### Has Unsent Messages
```javascript
const hasUnsent = useChatStore(state => 
  state.sendingMessages.size > 0 || state.failedMessages.size > 0
);
```

### Active Conversation Data
```javascript
const conversation = useChatStore(state => 
  state.activeConversationId 
    ? state.conversations.get(state.activeConversationId)
    : null
);
```