# Architecture Decision Records (ADRs)

## ADR-001: Modular Store Architecture

### Status
Accepted

### Context
The original `chatStore.js` was 1481 lines long, making it difficult to:
- Find specific functionality
- Test individual features
- Add new features without increasing complexity
- Understand data flow
- Onboard new developers

### Decision
Split the monolithic store into modular slices based on feature domains:
- Socket management
- Message operations
- Conversation management
- Queue handling
- Usage tracking
- Typing indicators
- Like functionality

### Consequences
**Positive:**
- Better code organization
- Easier testing
- Clear separation of concerns
- Smaller, focused files
- Easier to maintain

**Negative:**
- More files to navigate
- Need to understand slice interactions
- Potential for circular dependencies

### Mitigation
- Comprehensive documentation
- Clear naming conventions
- Dependency flow diagrams

---

## ADR-002: State Management with Zustand

### Status
Inherited (from original design)

### Context
Need for client-side state management that:
- Works well with React
- Supports real-time updates
- Has minimal boilerplate
- Allows subscriptions to specific state slices

### Decision
Use Zustand with `subscribeWithSelector` middleware

### Rationale
- Lightweight (8kb)
- No providers needed
- Built-in TypeScript support
- Selective subscriptions prevent unnecessary renders
- Works outside React components

### Alternatives Considered
- Redux: Too much boilerplate
- MobX: More complex, larger bundle
- Context API: Performance issues with frequent updates
- Jotai: Less mature ecosystem

---

## ADR-003: WebSocket Event Handling

### Status
Accepted

### Context
Need to handle multiple WebSocket events efficiently while maintaining:
- Clear event flow
- Error handling
- Reconnection logic
- State synchronization

### Decision
Centralize all socket event handlers in a single file that:
- Maps events to store methods
- Handles all socket lifecycle events
- Provides consistent error handling

### Consequences
- All socket logic in one place
- Easy to add new events
- Clear data flow from socket to store
- Simplified testing

---

## ADR-004: Optimistic Updates

### Status
Accepted

### Context
Users expect immediate feedback when sending messages, but network latency can cause delays.

### Decision
Implement optimistic updates:
1. Add message to UI immediately
2. Send to server in background
3. Update/confirm when server responds
4. Handle failures gracefully

### Implementation
- Temporary messages in `sendingMessages` Map
- Unique IDs generated client-side
- Failed messages tracked separately
- Retry mechanism available

### Trade-offs
- More complex state management
- Need to handle edge cases
- Better user experience
- Reduced perceived latency

---

## ADR-005: Message Ordering Strategy

### Status
Accepted

### Context
Messages can arrive out of order due to:
- Network delays
- Processing queues
- Retry mechanisms
- Optimistic updates

### Decision
Always sort messages chronologically by timestamp:
- Single source of truth for ordering
- Handle Firebase timestamp objects
- Sort on every update

### Rationale
- Consistent message order
- Simple mental model
- No complex reordering logic
- Works with pagination

---

## ADR-006: Error Recovery Patterns

### Status
Accepted

### Context
Multiple failure points:
- WebSocket connection
- Message sending
- AI service errors
- Usage limits

### Decision
Implement specific recovery for each error type:
- **Connection**: Automatic reconnection with exponential backoff
- **Message Send**: Retry button, preserve message content
- **LLM Errors**: Special retry logic with limits
- **Usage Limits**: Clear messaging, upgrade prompts

### Benefits
- Resilient user experience
- Clear error communication
- Graceful degradation
- Recovery options

---

## ADR-007: State Persistence Strategy

### Status
Proposed

### Context
Currently, all state is lost on page refresh.

### Decision
Do not persist chat state because:
- Messages are loaded from server
- WebSocket reconnects automatically
- Avoids stale data issues
- Simpler state management

### Future Consideration
Could add selective persistence for:
- Draft messages
- UI preferences
- Conversation list

---

## ADR-008: Usage Tracking Architecture

### Status
Accepted

### Context
Need to track usage limits per character for free users.

### Decision
Store usage in a Map keyed by characterId:
- Fetch on initialization
- Update after sending messages
- Real-time updates via WebSocket

### Benefits
- Per-character limits
- Easy to check before sending
- Supports multiple characters
- Clear upgrade paths

---

## ADR-009: Queue State Management

### Status
Accepted

### Context
AI responses are processed sequentially, creating a queue.

### Decision
Track queue state with:
- Position indicators
- Processing status
- Message relationships
- Real-time updates

### Implementation
- `queueStatus` Map for overall state
- Individual message status
- WebSocket events for updates
- Visual queue indicators

---

## ADR-010: Slice Interdependencies

### Status
Accepted

### Context
Some slices need to interact with others.

### Decision
Allow controlled dependencies:
- Slices can call other slice methods via `get()`
- Avoid circular dependencies
- Document all interactions

### Guidelines
1. Prefer events over direct calls
2. Keep dependencies minimal
3. Document in slice headers
4. Consider extracting shared logic

---

## ADR-011: Testing Strategy

### Status
Proposed

### Context
Modular architecture enables better testing.

### Recommendations
1. **Unit Tests**: Test each slice in isolation
2. **Integration Tests**: Test slice interactions
3. **Mock Socket.io**: Use socket.io-mock
4. **State Assertions**: Test state transitions
5. **Error Scenarios**: Test all error paths

### Benefits
- Faster test execution
- Better coverage
- Easier debugging
- Confidence in changes

---

## ADR-012: Performance Optimizations

### Status
Accepted

### Context
Chat can have many messages and frequent updates.

### Decisions
1. Use Maps for O(1) lookups
2. Selective subscriptions with Zustand
3. Debounce typing indicators
4. Limit message history in memory
5. Lazy load older messages

### Trade-offs
- More complex code
- Better performance
- Reduced memory usage
- Smoother UX