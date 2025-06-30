# Conversation State Service Flow Diagrams

## Message Queue Flow

```mermaid
flowchart TB
    Start([New Message Received]) --> Check{Can Process<br/>Immediately?}
    
    Check -->|Yes| SetProc[Set Processing State]
    Check -->|No| AddQueue[Add to Queue]
    
    SetProc --> Process[Process Message]
    Process --> Complete[Complete Processing]
    Complete --> CheckQueue{Queue<br/>Empty?}
    
    CheckQueue -->|Yes| SetIdle[Set State: IDLE]
    CheckQueue -->|No| SetQueued[Set State: QUEUED]
    
    AddQueue --> ReturnPos[Return Queue Position]
    ReturnPos --> WaitTurn[Wait for Turn]
    
    WaitTurn --> GetNext[Get Next Message]
    GetNext --> CheckExp{Message<br/>Expired?}
    
    CheckExp -->|Yes| RemoveExp[Remove Expired]
    CheckExp -->|No| SetProc
    
    RemoveExp --> GetNext
    
    SetIdle --> End([End])
    SetQueued --> End
    
    style Start fill:#90EE90
    style End fill:#FFB6C1
    style SetProc fill:#87CEEB
    style Process fill:#DDA0DD
    style CheckExp fill:#F0E68C
```

## State Transition Diagram

```mermaid
stateDiagram-v2
    [*] --> IDLE: New Conversation
    
    IDLE --> PROCESSING: Start Processing
    IDLE --> QUEUED: Add Message to Empty Queue
    
    PROCESSING --> IDLE: Complete (No Queue)
    PROCESSING --> QUEUED: Complete (Has Queue)
    PROCESSING --> PROCESSING: Reset Stuck Process
    
    QUEUED --> PROCESSING: Process Next Message
    QUEUED --> IDLE: All Messages Expired
    
    note right of PROCESSING
        Timeout: 2 minutes
        Auto-reset if stuck
    end note
    
    note right of QUEUED
        Max Size: 10 messages
        TTL: 5 minutes
    end note
```

## Processing Lifecycle

```mermaid
flowchart LR
    subgraph "Message Lifecycle"
        Receive[Message Received] --> Queue{Queue?}
        Queue -->|Direct| P1[Set Processing]
        Queue -->|Queued| Q1[Add to Queue]
        
        Q1 --> Q2[Wait Turn]
        Q2 --> Q3[Get from Queue]
        Q3 --> P1
        
        P1 --> P2[Process Message]
        P2 --> P3[Generate Response]
        P3 --> P4[Complete Processing]
        
        P4 --> Next{More in Queue?}
        Next -->|Yes| Q3
        Next -->|No| Done[Set Idle]
    end
    
    style Receive fill:#90EE90
    style Done fill:#FFB6C1
    style P2 fill:#DDA0DD
```

## Cleanup Process Flow

```mermaid
flowchart TD
    Timer[Cleanup Timer<br/>Every 60s] --> GetAll[Get All Conversations]
    
    GetAll --> Loop{For Each<br/>Conversation}
    
    Loop --> Read[Read State]
    Read --> CheckMsg{Check Each<br/>Message}
    
    CheckMsg --> Expired{Expired?}
    Expired -->|Yes| Remove[Remove Message]
    Expired -->|No| Keep[Keep Message]
    
    Remove --> More{More<br/>Messages?}
    Keep --> More
    
    More -->|Yes| CheckMsg
    More -->|No| Update{Queue<br/>Changed?}
    
    Update -->|Yes| Save[Save Updated State]
    Update -->|No| Skip[Skip Save]
    
    Save --> NextConv{More<br/>Conversations?}
    Skip --> NextConv
    
    NextConv -->|Yes| Loop
    NextConv -->|No| Report[Log Cleanup Stats]
    
    Report --> Wait[Wait 60s]
    Wait --> Timer
    
    style Timer fill:#87CEEB
    style Report fill:#90EE90
    style Remove fill:#F0E68C
```

## Error Recovery Flow

```mermaid
flowchart TB
    Error([Error Detected]) --> Type{Error Type?}
    
    Type -->|Queue Full| Full[Return Queue Full Error]
    Type -->|Redis Error| Redis[Log & Throw Error]
    Type -->|Stuck Process| Stuck[Check Processing Time]
    Type -->|Corrupt State| Corrupt[Reinitialize State]
    
    Stuck --> Timeout{Timeout<br/>Exceeded?}
    Timeout -->|Yes| Reset[Reset Processing State]
    Timeout -->|No| Continue[Continue Processing]
    
    Reset --> Recover[Set State Based on Queue]
    Corrupt --> Init[Create Fresh State]
    
    Full --> UserAction[User Must Retry Later]
    Redis --> Retry[Caller Should Retry]
    
    Recover --> Resume([Resume Operations])
    Init --> Resume
    Continue --> Resume
    
    style Error fill:#FFB6C1
    style Resume fill:#90EE90
    style Full fill:#F0E68C
    style Redis fill:#F0E68C
```

## WebSocket Integration Flow

```mermaid
sequenceDiagram
    participant Client
    participant WebSocket
    participant ConvState as Conversation State
    participant Processor
    participant AI
    
    Client->>WebSocket: Send Message
    WebSocket->>ConvState: canProcessImmediately()
    
    alt Can Process
        ConvState-->>WebSocket: true
        WebSocket->>ConvState: setProcessing()
        WebSocket->>AI: Process Message
        AI-->>WebSocket: Response
        WebSocket->>ConvState: completeProcessing()
        WebSocket->>Client: Send Response
    else Must Queue
        ConvState-->>WebSocket: false
        WebSocket->>ConvState: addToQueue()
        ConvState-->>WebSocket: Queue Position
        WebSocket->>Client: Message Queued
        
        Note over Processor: Background Process
        Processor->>ConvState: getNextQueued()
        ConvState-->>Processor: Message Data
        Processor->>ConvState: setProcessing()
        Processor->>AI: Process Message
        AI-->>Processor: Response
        Processor->>ConvState: removeFromQueue()
        Processor->>ConvState: completeProcessing()
        Processor->>Client: Send Response
    end
```

## Queue Status Monitoring

```mermaid
flowchart LR
    subgraph "Status Collection"
        Monitor[Monitor Request] --> GS[Get Status]
        GS --> State[Read State]
        State --> Format[Format Output]
        
        Format --> Status{Status Data}
        Status --> ID[Conversation ID]
        Status --> ST[Current State]
        Status --> QL[Queue Length]
        Status --> CP[Currently Processing]
        Status --> TS[Timestamps]
    end
    
    subgraph "Aggregate Stats"
        All[Get All States] --> Calc[Calculate Stats]
        Calc --> Total[Total Conversations]
        Calc --> ByState[Count by State]
        Calc --> Avg[Average Queue Length]
        Calc --> Stuck[Stuck Processes]
    end
    
    Monitor --> All
    
    style Monitor fill:#87CEEB
    style Status fill:#90EE90
    style Calc fill:#DDA0DD
```

## Message Expiration Flow

```mermaid
flowchart TB
    Message[Queued Message] --> Age{Check Age}
    
    Age --> Calc[Current Time - Queued Time]
    Calc --> Compare{Age > TTL?}
    
    Compare -->|No| Valid[Keep in Queue]
    Compare -->|Yes| Expired[Mark Expired]
    
    Expired --> Remove[Remove from Queue]
    Remove --> Log[Log Expiration]
    Log --> Next[Check Next Message]
    
    Valid --> Process[Available for Processing]
    
    style Message fill:#87CEEB
    style Expired fill:#F0E68C
    style Valid fill:#90EE90
    style Remove fill:#FFB6C1
```

## Complete System Flow

```mermaid
flowchart TB
    subgraph "Input Layer"
        WS[WebSocket Message]
        API[API Request]
        Timer[Cleanup Timer]
    end
    
    subgraph "State Service"
        SM[State Manager]
        QM[Queue Manager]
        PM[Processing Manager]
        CM[Cleanup Manager]
        ST[Status Manager]
    end
    
    subgraph "Storage"
        Redis[(Redis)]
    end
    
    subgraph "Consumers"
        Proc[Message Processor]
        AI[AI Service]
        Mon[Monitoring]
    end
    
    WS --> SM
    API --> SM
    Timer --> CM
    
    SM <--> Redis
    QM <--> SM
    PM <--> SM
    CM <--> Redis
    ST <--> SM
    
    Proc --> QM
    Proc --> PM
    AI --> PM
    Mon --> ST
    
    style WS fill:#87CEEB
    style API fill:#87CEEB
    style Timer fill:#87CEEB
    style Redis fill:#FFE4B5
    style AI fill:#DDA0DD
```