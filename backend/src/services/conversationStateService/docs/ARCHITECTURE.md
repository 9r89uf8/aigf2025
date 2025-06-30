# Conversation State Service Architecture

## System Design Overview

The Conversation State Service is designed as a modular, Redis-backed state management system that ensures ordered message processing in a distributed chat application. It prevents race conditions, manages message queues, and provides real-time monitoring capabilities.

## Core Components

### 1. State Manager (`stateManager.js`)
**Responsibility**: Core state persistence and retrieval

- Manages conversation state objects in Redis
- Handles state initialization for new conversations
- Detects stuck processing states
- Validates state integrity

**Key Design Decisions**:
- States expire after 1 hour (configurable) to prevent memory bloat
- Automatic state validation ensures data consistency
- Stuck detection prevents permanent processing blocks

### 2. Queue Manager (`queueManager.js`)
**Responsibility**: Message queue operations

- FIFO queue implementation per conversation
- Queue size limits to prevent abuse
- Automatic expiration of old messages
- Preserves original message timestamps

**Key Design Decisions**:
- Maximum 10 messages per queue (configurable)
- Messages expire after 5 minutes
- Expired messages are filtered on read, not write

### 3. Processing Manager (`processingManager.js`)
**Responsibility**: Processing state control

- Prevents concurrent message processing
- Handles processing timeouts
- Manages state transitions
- Provides processing completion flow

**Key Design Decisions**:
- Single message processing per conversation
- 2-minute processing timeout
- Automatic reset for stuck processes

### 4. Cleanup Manager (`cleanupManager.js`)
**Responsibility**: Maintenance and cleanup

- Periodic cleanup of expired messages
- Manual cleanup capabilities
- Resource management
- Performance optimization

**Key Design Decisions**:
- Runs every 60 seconds
- Batch processing for efficiency
- Graceful error handling per conversation

### 5. Status Manager (`statusManager.js`)
**Responsibility**: Monitoring and statistics

- Real-time queue status
- Aggregate statistics
- Health monitoring
- Debug capabilities

**Key Design Decisions**:
- Lightweight status queries
- Formatted output for monitoring tools
- Error resilience in status collection

## Data Flow Patterns

### Message Reception Flow
```
1. New message arrives via WebSocket
2. Check canProcessImmediately()
3a. If true: Set processing state → Process → Complete
3b. If false: Add to queue → Return queue position
4. Queue processor picks up queued messages
```

### Queue Processing Flow
```
1. Get next queued message
2. Check for expiration
3. Set processing state
4. Process message
5. Remove from queue
6. Complete processing
7. Check for more messages
```

### State Transition Flow
```
IDLE → PROCESSING (when message processing starts)
IDLE → QUEUED (when message added to empty queue)
PROCESSING → IDLE (when processing completes, no queue)
PROCESSING → QUEUED (when processing completes, queue exists)
QUEUED → PROCESSING (when next message starts)
```

## Redis Schema

### Key Structure
```
conversation_state:{userId}_{characterId}
```

### State Object Structure
```javascript
{
  conversationId: "user123_char456",
  state: "idle|processing|queued",
  messageQueue: [
    {
      messageId: "msg_789",
      userId: "user123",
      characterId: "char456",
      messageData: { content: "Hello", type: "text" },
      queuedAt: "2025-01-27T10:00:00Z",
      originalTimestamp: 1706352000000,
      tempId: "temp_123"
    }
  ],
  currentlyProcessing: "msg_123" | null,
  lastProcessedAt: "2025-01-27T09:55:00Z",
  processingStartedAt: "2025-01-27T09:59:00Z" | null,
  createdAt: "2025-01-27T09:00:00Z",
  updatedAt: "2025-01-27T10:00:00Z"
}
```

## Error Handling Strategy

### Graceful Degradation
- If Redis is unavailable, operations fail fast
- Individual conversation errors don't affect others
- Cleanup continues even with partial failures

### Error Categories
1. **Queue Full**: Thrown when MAX_QUEUE_SIZE exceeded
2. **Redis Errors**: Connection or operation failures
3. **State Corruption**: Invalid state data detected
4. **Timeout Errors**: Processing timeout exceeded

### Recovery Mechanisms
- Automatic reset for stuck processes
- Expired message cleanup
- State reinitialization for corrupted data

## Performance Considerations

### Optimization Strategies
1. **Batch Operations**: Cleanup processes multiple conversations in one pass
2. **Lazy Expiration**: Messages expire on read, not write
3. **Efficient Keys**: Use Redis patterns for bulk operations
4. **Connection Pooling**: Reuse Redis connections

### Scalability
- Horizontal scaling supported (Redis handles distributed state)
- No in-memory state (all state in Redis)
- Cleanup can run on separate process
- Queue limits prevent unbounded growth

### Performance Metrics
- Average state read: < 5ms
- Queue operations: < 10ms
- Cleanup cycle: < 100ms for 1000 conversations
- Memory per conversation: ~2KB

## Security Considerations

### Access Control
- Conversation IDs include user ID for access validation
- No cross-conversation data leakage
- Queue size limits prevent DoS

### Data Privacy
- Messages in queue contain minimal data
- Automatic expiration limits data retention
- No PII in logs

## Integration Points

### WebSocket Handler
- Receives messages
- Checks processing availability
- Emits queue status updates

### Message Queue Processor
- Polls for queued messages
- Manages processing lifecycle
- Handles retry logic

### AI Service
- Consumes messages from queue
- Updates processing state
- Reports completion

## Module Dependencies

```
index.js
├── constants.js (shared by all)
├── stateManager.js
│   └── uses: constants, logger, redis
├── queueManager.js
│   └── uses: constants, stateManager, logger
├── processingManager.js
│   └── uses: constants, stateManager, logger
├── cleanupManager.js
│   └── uses: constants, redis, logger
├── statusManager.js
│   └── uses: constants, stateManager, redis, logger
└── utils.js
    └── uses: logger
```

## Future Considerations

### Potential Enhancements
1. **Priority Queues**: Support for urgent messages
2. **Queue Persistence**: Backup queues to database
3. **Advanced Monitoring**: Prometheus metrics
4. **Dynamic Limits**: Per-user queue limits
5. **Message Compression**: Reduce Redis memory usage

### Scaling Considerations
1. **Redis Cluster**: Support for Redis clustering
2. **Queue Sharding**: Distribute queues across nodes
3. **Event Streaming**: Replace polling with pub/sub
4. **Rate Limiting**: Per-user rate limits