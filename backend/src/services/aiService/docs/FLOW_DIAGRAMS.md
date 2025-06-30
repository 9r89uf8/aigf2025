# AI Service Flow Diagrams

This document provides visual representations of the data flow through the AI Service modules after refactoring.

## Main Response Generation Flow (Breaking Changes)

```
┌─────────────────┐
│   API Request   │
│  generateAI     │
│   Response()    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│    index.js     │
│ - Public API    │
│ - Entry point   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ responseGenerator│
│    .js          │
│ - Get character │
│ - Get context   │
│ - Validate input│
│ - Orchestrate   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ messageProcessor│
│    .js          │
│ - Build message │
│   array         │
│ - Filter LLM    │
│   errors        │
│ - Track token   │
│   savings       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│conversationFor- │
│   matter.js     │
│ - Filter LLM    │
│   errors        │
│ - Alternating   │
│   pattern       │
│ - Combine msgs  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ responseTypes.js│
│                 │
│ ┌─────────────┐ │
│ │    Text     │ │
│ │   Response  │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │   Audio     │ │
│ │  Response   │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │   Media     │ │
│ │  Response   │ │
│ └─────────────┘ │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ qualityControl  │
│    .js          │
│ - Assess quality│
│ - Retry if bad  │
│ - Smart truncate│
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ responseCleanup │
│    .js          │
│ - Remove think  │
│   tags          │
│ - Clean text    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ contentFilter   │
│    .js          │
│ - Safety check  │
│ - Block harmful │
│   content       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│personalityEngine│
│    .js          │
│ - Apply traits  │
│ - Personality   │
│   functions     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ cacheManager    │
│    .js          │
│ - Cache pattern │
│ - Store for     │
│   consistency   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Final Response │
│                 │
│ - Content       │
│ - Metadata      │
│ - Type info     │
└─────────────────┘
```

## Enhanced Quality Control Flow (With Brevity Prompts)

```
┌─────────────────┐
│  AI Response    │
│   Generated     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ responseCleanup │
│    .js          │
│ - Remove 8 tag  │
│   patterns:     │
│   <think>,      │
│   <thinking>,   │
│   [thinking],   │
│   *thinking*,   │
│   (thinking),   │
│   <!-- thinking,│
│   <reasoning>,  │
│   [reasoning]   │
│ - Clean text    │
│ - Normalize     │
│   whitespace    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ responseUtils   │
│ assessResponse  │
│   Quality()     │
│                 │
│ ┌─────────────┐ │
│ │ Complete?   │ │
│ │ Too long?   │ │
│ │ Coherent?   │ │
│ │ Repetitive? │ │
│ │ Needs retry?│ │
│ └─────────────┘ │
└─────────┬───────┘
          │
        ┌─▼─┐
        │ ? │ Quality OK?
        └─┬─┘
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌───────┐   ┌───────┐
│ Good  │   │ Retry │
│Quality│   │Needed │
└───┬───┘   └───┬───┘
    │           │
    │           ▼
    │       ┌─────────────────┐
    │       │Brevity Prompts: │
    │       │- 1 short sent   │
    │       │- Under 20 words │
    │       │- Max 15 words   │
    │       └───┬─────────────┘
    │           │
    │           ▼
    │       ┌───────┐
    │       │Generate│
    │       │ Again │
    │       └───┬───┘
    │           │
    │       ┌───▼───┐
    │       │ Max   │
    │       │Retries│
    │       │Reached│
    │       └───┬───┘
    │           │
    └───────────▼
┌─────────────────┐
│ Smart Truncate  │
│                 │
│ - Sentence      │
│   boundaries    │
│ - Word breaks   │
│ - Preserve      │
│   meaning       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Final Result   │
└─────────────────┘
```

## Message Processing Flow (With LLM Error Filtering)

```
┌─────────────────┐
│ Conversation    │
│   Context       │
│                 │
│ [msg1, msg2,    │
│  msg3, ...]     │
│ (May include    │
│  LLM errors)    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│messageProcessor │
│    .js          │
│ - Sort messages │
│ - Validate      │
│ - Build array   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│conversationFor- │
│   matter.js     │
│ - Filter msgs   │
│   with          │
│   hasLLMError   │
│ - Log token     │
│   savings       │
│ - Reorganize to │
│   alternating   │
│   pattern       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Handle          │
│ Consecutive     │
│ User Messages   │
│                 │
│ "Hi" + "Hello"  │
│ → "Hi\n\nHello" │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Add Current     │
│ Message         │
│                 │
│ Check for       │
│ duplicates      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Build Final     │
│ Message Array   │
│                 │
│ [system,        │
│  user,          │
│  assistant,     │
│  user]          │
└─────────────────┘
```

## Enhanced Fallback System Flow (DeepSeek Forced)

```
┌─────────────────┐
│   Try DeepSeek  │
│  (Forced Model) │
│ Ignores char    │
│ settings        │
└─────────┬───────┘
          │
        ┌─▼─┐
        │ ? │ Success?
        └─┬─┘
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌───────┐   ┌───────┐
│Success│   │ Error │
└───┬───┘   └───┬───┘
    │           │
    │           ▼
    │       ┌───────┐
    │       │Check  │
    │       │Together│
    │       │.ai    │
    │       │Available│
    │       └───┬───┘
    │           │
    │         ┌─▼─┐
    │         │ ? │ Available?
    │         └─┬─┘
    │     ┌─────┴─────┐
    │     │           │
    │     ▼           ▼
    │ ┌───────┐   ┌───────┐
    │ │ Try   │   │Service│
    │ │Together│   │ Down  │
    │ │.ai    │   │       │
    │ └───┬───┘   └───┬───┘
    │     │           │
    │   ┌─▼─┐         │
    │   │ ? │ Success? │
    │   └─┬─┘         │
    │┌────┴────┐      │
    ││         │      │
    │▼         ▼      │
┌───────┐ ┌───────┐   │
│Success│ │ Error │   │
└───┬───┘ └───┬───┘   │
    │         │       │
    └─────────┼───────┘
              │
              ▼
        ┌─────────────┐
        │ Throw LLM   │
        │ Error Object│
        │ {isLLMError:│
        │   true}     │
        └─────────────┘
```

## LLM Error Processing Flow

```
┌─────────────────┐
│ qualityControl  │
│ LLM Error       │
│ {isLLMError:    │
│  true}          │
└─────────┬───────┘
          │ (thrown)
          ▼
┌─────────────────┐
│ Queue Processor │
│ Catches Error   │
└─────────┬───────┘
          │
        ┌─▼─┐
        │ ? │ isLLMError?
        └─┬─┘
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌───────────┐ ┌─────────────┐
│ LLM Error │ │Other Errors │
│Processing │ │(Traditional)│
└─────┬─────┘ └─────┬───────┘
      │             │
      ▼             ▼
┌─────────────┐ ┌─────────────┐
│ Parallel    │ │ Generate    │
│ Actions:    │ │ AI Error    │
│             │ │ Response    │
│ ┌─────────┐ │ └─────────────┘
│ │Database │ │
│ │Update   │ │
│ │(hasLLM  │ │
│ │Error:   │ │
│ │true)    │ │
│ └─────────┘ │
│             │
│ ┌─────────┐ │
│ │WebSocket│ │
│ │Event    │ │
│ │(message:│ │
│ │llm_error│ │
│ └─────────┘ │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Frontend    │
│ Error State │
│ Management  │
│             │
│ - Red Style │
│ - Warning   │
│ - Persists  │
│   Refresh   │
└─────────────┘
```

## Content Safety & Personality Flow

```
┌─────────────────┐
│  Clean AI       │
│  Response       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ contentFilter   │
│    .js          │
│ - Safety check  │
│ - Spam detect   │
│ - Validate      │
└─────────┬───────┘
          │
        ┌─▼─┐
        │ ? │ Safe?
        └─┬─┘
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌───────┐   ┌───────┐
│ Safe  │   │Blocked│
│Content│   │Content│
└───┬───┘   └───┬───┘
    │           │
    │           ▼
    │       ┌───────┐
    │       │ Get   │
    │       │Safe   │
    │       │Fallback│
    │       │Message│
    │       └───┬───┘
    │           │
    └───────────▼
┌─────────────────┐
│personalityEngine│
│    .js          │
│ - Get traits    │
│ - Apply mods    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│responsePersonal-│
│   izer.js       │
│ - Flirty tone   │
│ - Humor         │
│ - Intellectual  │
│ - Formality     │
│ - Emojis        │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Personalized    │
│   Response      │
└─────────────────┘
```

## Media Processing Flow

```
┌─────────────────┐
│  AI Response    │
│   with Media    │
│  Suggestion     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ mediaHandler.js │
│ extractMedia    │
│ Suggestion()    │
│                 │
│ ┌─────────────┐ │
│ │ Explicit?   │ │
│ │ Implicit?   │ │
│ │ Sentiment?  │ │
│ └─────────────┘ │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ selectMedia     │
│ FromGallery()   │
│                 │
│ - Filter by type│
│ - Filter by tags│
│ - Filter by mood│
│ - Select best   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Selected Media  │
│                 │
│ - URL           │
│ - Type          │
│ - Caption       │
│ - Metadata      │
└─────────────────┘
```

## Caching Architecture Flow

```
┌─────────────────┐
│  Character      │
│  Response       │
│  Generated      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ cacheManager.js │
│ cacheResponse   │
│ Pattern()       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│     Redis       │
│   Storage       │
│                 │
│ ┌─────────────┐ │
│ │ Patterns    │ │
│ │ Summaries   │ │
│ │ Metrics     │ │
│ │ Stats       │ │
│ └─────────────┘ │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Future Request  │
│ finds Similar   │
│ Patterns        │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Enhanced        │
│ Consistency     │
│ & Quality       │
└─────────────────┘
```

## Module Dependency Visualization

```
               index.js
                  │
                  ▼
          responseGenerator.js
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
messageProcessor responseTypes contentFilter
        │         │         │
        ▼         ▼         │
conversationFor- qualityControl │
    matter.js     │         │
                  ▼         │
            responseCleanup │
                  │         │
                  ▼         ▼
            responseUtils personalityEngine
                  │         │
                  │         ▼
                  │   responsePersonalizer
                  │         │
        ┌─────────┼─────────┘
        │         │
        ▼         ▼
   mediaHandler cacheManager
        │         │
        │         ▼
        │    speechSynthesis
        │         │
        └─────────┘
```

## Error Handling Flow

```
Every Module Operation:
┌─────────────────┐
│   Function      │
│   Execution     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Try Block      │
│                 │
│ - Execute logic │
│ - Log progress  │
└─────────┬───────┘
          │
        ┌─▼─┐
        │ ? │ Error?
        └─┬─┘
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌───────┐   ┌───────┐
│Success│   │ Catch │
└───┬───┘   └───┬───┘
    │           │
    │           ▼
    │       ┌───────┐
    │       │ Log   │
    │       │ Error │
    │       │ with  │
    │       │Context│
    │       └───┬───┘
    │           │
    │         ┌─▼─┐
    │         │ ? │ LLM Error?
    │         └─┬─┘
    │     ┌─────┴─────┐
    │     │           │
    │     ▼           ▼
    │ ┌───────┐   ┌───────┐
    │ │ Throw │   │ Try   │
    │ │ LLM   │   │Graceful│
    │ │ Error │   │Fallback│
    │ │ Object│   └───┬───┘
    │ └───────┘       │
    │                 │
    │               ┌─▼─┐
    │               │ ? │ Possible?
    │               └─┬─┘
    │           ┌─────┴─────┐
    │           │           │
    │           ▼           ▼
    │       ┌───────┐   ┌───────┐
    │       │Fallback│   │ Re-   │
    │       │Success│   │ throw │
    │       └───┬───┘   └───┬───┘
    │           │           │
    └───────────┼───────────┘
                │
                ▼
          ┌───────────┐
          │  Return   │
          │  Result   │
          │  or Throw │
          └───────────┘
```