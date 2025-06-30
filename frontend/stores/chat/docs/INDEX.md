# Chat Store Documentation Index

Welcome to the Chat Store documentation. This modular store manages all real-time messaging functionality in the frontend application.

## 📚 Documentation Structure

### 1. [README.md](../README.md)
**Start Here** - Overview of the chat store architecture, core concepts, and detailed slice descriptions.

### 2. [FLOW_DIAGRAMS.md](../FLOW_DIAGRAMS.md)
Visual flow diagrams showing:
- Message lifecycle
- Connection states
- Error handling flows
- Queue processing
- Component integration

### 3. [QUICK_REFERENCE.md](../QUICK_REFERENCE.md)
Quick code snippets for:
- Common tasks
- State structure
- WebSocket events
- Error handling patterns
- Performance tips

### 4. [ARCHITECTURE_DECISIONS.md](../ARCHITECTURE_DECISIONS.md)
Architecture Decision Records (ADRs) explaining:
- Why we chose this structure
- Trade-offs considered
- Future improvements

## 🗂️ Store Structure

```
chat/
├── docs/                       # Documentation
│   └── INDEX.md               # This file
├── slices/                    # Feature-based slices
│   ├── socketSlice.js         # WebSocket connection (96 lines)
│   ├── messageSlice.js        # Messages & sending (471 lines)
│   ├── messageLikesSlice.js   # Like functionality (132 lines)
│   ├── conversationSlice.js   # Conversations (137 lines)
│   ├── conversationMessagesSlice.js # Loading (158 lines)
│   ├── queueSlice.js          # Queue management (178 lines)
│   ├── usageSlice.js          # Usage tracking (137 lines)
│   └── typingSlice.js         # Typing indicators (48 lines)
├── handlers/                  # Event processing
│   └── socketEventHandlers.js # Socket.io events (94 lines)
├── utils/                     # Helpers
│   └── messageUtils.js        # Message utilities (47 lines)
├── store.js                   # Combines slices (29 lines)
└── index.js                   # Main export (5 lines)
```

## 🚀 Quick Start

1. **Import the store:**
   ```javascript
   import useChatStore from '@/stores/chatStore';
   ```

2. **Initialize connection:**
   ```javascript
   useEffect(() => {
     useChatStore.getState().initialize();
     return () => useChatStore.getState().cleanup();
   }, []);
   ```

3. **Use in components:**
   ```javascript
   const { messages, sendMessage, isConnected } = useChatStore();
   ```

## 🔍 Finding What You Need

### By Feature
- **Sending messages** → `messageSlice.js`
- **WebSocket connection** → `socketSlice.js`
- **Like/unlike** → `messageLikesSlice.js`
- **Conversations** → `conversationSlice.js`
- **Queue status** → `queueSlice.js`
- **Usage limits** → `usageSlice.js`
- **Typing indicators** → `typingSlice.js`

### By Task
- **Send a message** → See `sendMessage()` in messageSlice
- **Handle errors** → Check error handling in FLOW_DIAGRAMS
- **Track usage** → See usageSlice methods
- **Retry failed message** → See `retryMessage()` in messageSlice

### By Event
- **Socket events** → See socketEventHandlers.js
- **Message events** → Listed in QUICK_REFERENCE
- **Error events** → See error flow in FLOW_DIAGRAMS

## 📊 Key Concepts

### 1. **Optimistic Updates**
Messages appear instantly in the UI, then sync with server.

### 2. **Queue System**
Messages are processed sequentially by the AI service.

### 3. **Error Recovery**
All errors have recovery mechanisms (retry, reconnect).

### 4. **Usage Tracking**
Per-character limits for free users with clear upgrade paths.

### 5. **Real-time Sync**
WebSocket events keep all clients synchronized.

## 🛠️ Common Operations

### Send a Message
```javascript
await sendMessage(conversationId, 'Hello!', 'text');
```

### Like a Message
```javascript
await likeMessage(messageId, true);
```

### Check Connection
```javascript
const { isConnected } = useChatStore.getState();
```

### Get Usage
```javascript
const usage = getCharacterUsage(characterId);
```

## 🐛 Debugging

1. **Check store state:**
   ```javascript
   console.log(useChatStore.getState());
   ```

2. **Monitor changes:**
   ```javascript
   useChatStore.subscribe(console.log);
   ```

3. **Socket status:**
   - Check browser console for socket logs
   - Look for connection events

## 📈 Performance

- Uses Maps for O(1) lookups
- Selective subscriptions prevent unnecessary renders
- Messages sorted only when needed
- Optimistic updates for instant feedback

## 🔄 State Flow

1. **User Action** → Store Method
2. **Optimistic Update** → Immediate UI change
3. **Server Request** → Via WebSocket or API
4. **Server Response** → Event received
5. **State Update** → Final state synchronized
6. **UI Update** → Components re-render

## 📝 Best Practices

1. **Subscribe to specific state:**
   ```javascript
   const messages = useChatStore(state => state.messages.get(conversationId));
   ```

2. **Batch operations:**
   ```javascript
   const { sendMessage, isConnected } = useChatStore();
   ```

3. **Handle errors gracefully:**
   - Check connection status
   - Show retry options
   - Provide user feedback

4. **Clean up on unmount:**
   ```javascript
   useEffect(() => {
     // setup
     return () => cleanup();
   }, []);
   ```

## 🚦 Getting Help

1. **Architecture questions** → Read ARCHITECTURE_DECISIONS.md
2. **Implementation details** → Check specific slice files
3. **Data flow** → See FLOW_DIAGRAMS.md
4. **Code examples** → Look in QUICK_REFERENCE.md
5. **Not sure where to look?** → Start with README.md

## 🔮 Future Improvements

- Message search functionality
- Offline support with persistence
- Virtual scrolling for large conversations
- Enhanced media handling
- Read receipts

---

Remember: The store is designed to be modular and maintainable. Each slice handles one specific domain, making it easy to find and modify functionality.