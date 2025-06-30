# Chat Store Flow Diagrams

## Message Lifecycle Flow

```mermaid
graph TD
    A[User Types Message] --> B[sendMessage called]
    B --> C{Check Usage Limits}
    C -->|Limit Reached| D[Show Error Toast]
    C -->|Within Limits| E[Generate Message ID]
    E --> F[Create Optimistic Message]
    F --> G[Add to UI Immediately]
    G --> H[Send via WebSocket]
    H --> I{Server Response}
    I -->|Success| J[message:receive Event]
    I -->|Failure| K[Add to failedMessages]
    J --> L[handleMessageReceived]
    L --> M[Remove from sendingMessages]
    L --> N[Update Usage Stats]
    K --> O[Update UI Status: Failed]
    O --> P[User Can Retry]
    P --> B
```

## AI Response Flow

```mermaid
graph TD
    A[User Message Sent] --> B[Server Receives]
    B --> C[Add to Message Queue]
    C --> D[message:queued Event]
    D --> E[Update UI: Queued]
    E --> F[Queue Processes]
    F --> G[message:processing Event]
    G --> H[Update UI: Processing]
    H --> I{AI Service}
    I -->|Success| J[Generate Response]
    I -->|Failure| K[message:llm_error Event]
    J --> L[message:receive Event]
    L --> M[Add AI Message to UI]
    M --> N[Clear Queue Status]
    K --> O[Mark Message with Error]
    O --> P[Show Retry Button]
    P --> Q{User Retries?}
    Q -->|Yes| R[retryMessage]
    Q -->|No| S[Message Stays in Error State]
    R --> T{Retry Limit?}
    T -->|Not Reached| F
    T -->|Reached| U[Disable Retry]
```

## Connection State Flow

```mermaid
graph TD
    A[App Loads] --> B[initialize called]
    B --> C[Set isConnecting: true]
    C --> D[socketClient.connect]
    D --> E{Connection Result}
    E -->|Success| F[connected Event]
    E -->|Failure| G[Set connectionError]
    F --> H[Set isConnected: true]
    H --> I[setupSocketListeners]
    I --> J[fetchInitialUsage]
    J --> K[Ready State]
    G --> L[Show Error Toast]
    L --> M[Retry Connection]
    
    K --> N{Disconnect?}
    N -->|Yes| O[disconnected Event]
    O --> P[Set isConnected: false]
    P --> Q{Intentional?}
    Q -->|No| R[Auto Reconnect]
    Q -->|Yes| S[Stay Disconnected]
    R --> D
```

## Message Like Flow

```mermaid
graph TD
    A[User Clicks Like] --> B[likeMessage called]
    B --> C[Update UI Optimistically]
    C --> D[Send to Backend API]
    D --> E{API Response}
    E -->|Success| F[Like Persisted]
    E -->|Failure| G[Revert UI Change]
    G --> H[Show Error Toast]
    
    I[AI Likes Message] --> J[Server Sends Event]
    J --> K[message:liked Event]
    K --> L[handleAILike called]
    L --> M{Is AI Like?}
    M -->|Yes| N[Add to likedMessages]
    M -->|No| O[Ignore Event]
    N --> P[Show Success Toast]
    P --> Q[Update UI Heart Icon]
```

## Conversation Management Flow

```mermaid
graph TD
    A[User Opens Chat] --> B[joinConversation]
    B --> C{Conversation Exists?}
    C -->|No| D[loadConversation]
    C -->|Yes| E[Get from Cache]
    D --> F{API Response}
    F -->|404| G[createConversation]
    F -->|Success| H[Store in Map]
    G --> I[New Conversation Created]
    I --> H
    H --> J[Join Socket Room]
    J --> K{Messages Loaded?}
    K -->|No| L[loadMessages]
    K -->|Yes| M[Show Messages]
    L --> N[Try WebSocket First]
    N --> O{Socket Connected?}
    O -->|Yes| P[Load via Socket]
    O -->|No| Q[Load via API]
    P --> R[Process Messages]
    Q --> R
    R --> S[Extract Liked Messages]
    S --> T[Sort Chronologically]
    T --> M
```

## Queue Status Flow

```mermaid
graph TD
    A[Multiple Users Send Messages] --> B[Server Queue]
    B --> C[message:queued Events]
    C --> D[Update queueStatus Map]
    D --> E[Show Queue Position]
    E --> F{Next in Queue?}
    F -->|Yes| G[message:processing Event]
    F -->|No| H[Wait in Queue]
    G --> I[Update UI: Processing]
    I --> J[AI Generates Response]
    J --> K[message:response_linked Event]
    K --> L[Link Response to Original]
    L --> M[queue:status Event]
    M --> N[Update Queue Length]
    N --> O{More in Queue?}
    O -->|Yes| F
    O -->|No| P[Set Queue Idle]
```

## Error Handling Flow

```mermaid
graph TD
    A[Error Occurs] --> B{Error Type}
    B -->|Connection| C[Socket Error Event]
    B -->|Message Send| D[Catch in sendMessage]
    B -->|LLM Service| E[message:llm_error Event]
    B -->|Usage Limit| F[Check Before Send]
    
    C --> G[Update connectionError]
    G --> H[Show Reconnecting Toast]
    H --> I[Attempt Reconnect]
    
    D --> J[Add to failedMessages]
    J --> K[Update Message Status]
    K --> L[Show Retry Option]
    
    E --> M[Add to llmErrorMessages]
    M --> N[Mark Message with Error]
    N --> O[Enable Retry Button]
    O --> P{Retry Limit Check}
    P -->|Under Limit| Q[Allow Retry]
    P -->|At Limit| R[Disable Retry]
    
    F --> S[Show Upgrade Toast]
    S --> T[Prevent Message Send]
```

## State Synchronization Flow

```mermaid
graph TD
    A[State Change] --> B{Change Type}
    B -->|Message| C[Update messages Map]
    B -->|Usage| D[Update characterUsage Map]
    B -->|Queue| E[Update queueStatus Map]
    B -->|Typing| F[Update typingUsers Map]
    
    C --> G[Zustand Notifies Subscribers]
    D --> G
    E --> G
    F --> G
    
    G --> H[Components Re-render]
    H --> I[UI Updates]
    
    J[WebSocket Event] --> K[Handler Function]
    K --> L[State Update]
    L --> A
    
    M[User Action] --> N[Store Method]
    N --> O[Optimistic Update]
    O --> A
    O --> P[Server Request]
    P --> Q{Success?}
    Q -->|Yes| R[Confirm Update]
    Q -->|No| S[Revert Update]
    R --> A
    S --> A
```

## Usage Tracking Flow

```mermaid
graph TD
    A[App Initialize] --> B[fetchInitialUsage]
    B --> C[API: /auth/usage]
    C --> D[Process Usage Data]
    D --> E[Store per Character]
    E --> F[characterUsage Map]
    
    G[User Sends Message] --> H[Check Character Usage]
    H --> I{Within Limits?}
    I -->|Yes| J[Allow Send]
    I -->|No| K[Block Send]
    J --> L[Message Sent]
    L --> M[refreshCharacterUsage]
    M --> C
    
    K --> N[Show Limit Toast]
    N --> O[Suggest Premium]
    
    P[usage:update Event] --> Q[updateUsage]
    Q --> R[Update Specific Character]
    R --> F
```

## Component Integration Flow

```mermaid
graph TD
    A[Chat Component] --> B[useChatStore Hook]
    B --> C[Subscribe to State]
    C --> D{State Needed}
    D -->|Messages| E[messages.get conversationId]
    D -->|Connection| F[isConnected]
    D -->|Typing| G[getTypingUsers]
    D -->|Usage| H[getCharacterUsage]
    
    E --> I[Render Messages]
    F --> J[Show Connection Status]
    G --> K[Show Typing Indicator]
    H --> L[Show Usage Bar]
    
    M[User Interaction] --> N{Action Type}
    N -->|Send| O[Call sendMessage]
    N -->|Like| P[Call likeMessage]
    N -->|Retry| Q[Call retryMessage]
    N -->|Type| R[Call sendTyping]
    
    O --> S[Update Store]
    P --> S
    Q --> S
    R --> S
    S --> C
```

## Cleanup Flow

```mermaid
graph TD
    A[Component Unmounts] --> B[cleanup called]
    B --> C[Remove Event Listeners]
    C --> D[Disconnect Socket]
    D --> E[Reset All State]
    E --> F{State to Reset}
    F --> G[Clear messages Map]
    F --> H[Clear conversations Map]
    F --> I[Clear queueStatus Map]
    F --> J[Clear typingUsers Map]
    F --> K[Clear characterUsage Map]
    F --> L[Reset Connection State]
    G --> M[Store Clean]
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
```

## Notes

- **Optimistic Updates**: Most user actions update UI immediately for better UX
- **Error Recovery**: All errors have recovery mechanisms (retry, reconnect)
- **State Consistency**: WebSocket events and API responses keep state in sync
- **Performance**: Maps used for O(1) lookups, selective subscriptions prevent unnecessary renders
- **Queue System**: Ensures messages are processed in order, prevents AI response mixing