# AI Service Module Reference

This document provides detailed information about each module in the AI Service.

## Core Modules

### `index.js`
**Purpose**: Main entry point and public API

**Key Functions**:
- `generateAIResponse(params)` - Public API function exported to other services
- Provides backward compatibility with default export

**Dependencies**: `responseGenerator.js`

---

### `responseGenerator.js`
**Purpose**: Main orchestration of the AI response generation process

**Key Functions**:
- `generateAIResponse(params)` - Main entry point for response generation
- Coordinates all other modules to produce final response
- Handles error management and metrics collection
- **BREAKING CHANGE**: Forces DeepSeek model regardless of character settings (line 51: `model: 'deepseek-reasoner'`)

**Dependencies**: All other modules

**Important Changes**:
- DeepSeek is now the primary provider (OpenAI completely removed)
- Together.ai is the fallback provider
- Enhanced error metadata structure for LLM failures
- Character model settings are ignored to ensure consistency

---

### `responseTypes.js`
**Purpose**: Handles different types of AI responses

**Key Functions**:
- `generateTextResponse(messages, aiSettings, character)` - Text-only responses
- `generateAudioResponse(messages, aiSettings, character)` - Text + audio
- `generateMediaResponse(messages, aiSettings, character)` - Text + media

**Dependencies**: `qualityControl.js`, `speechSynthesis.js`, `mediaHandler.js`

---

### `qualityControl.js`
**Purpose**: Ensures response quality through assessment and retry logic, with specialized LLM error handling

**Key Functions**:
- `generateWithQualityControl(messages, aiSettings, character)` - Main quality control with retry logic (max 2 attempts)
- Private: `retryWithBrevity(messages, aiSettings, character, attempt)` - Retry with brevity prompts
- Private: `generateSingleResponse(messages, aiSettings, character)` - Single API call with DeepSeek → Together.ai fallback

**Brevity Prompts**:
```javascript
[
  "Respond in 1 short sentence only. Be natural and conversational.",
  "Keep response under 20 words. Be brief, human-like, and complete your thought.",
  "One quick, natural reply. Maximum 15 words. End with proper punctuation."
]
```

**Error Handling**:
- **LLM Provider Failures**: When both DeepSeek and Together.ai fail, throws structured LLM error object instead of returning fallback message
- **LLM Error Object Structure**:
  ```javascript
  {
    error: true,
    errorType: 'llm_failure',
    isLLMError: true,
    provider: 'fallback',
    originalError: string,
    qualityControl: {
      attempts: number,
      failed: true,
      error: string
    },
    timestamp: number
  }
  ```
- **Other Errors**: Traditional error handling with fallback responses

**Dependencies**: `responseCleanup.js`, `responseUtils.js`, DeepSeek client, Together.ai client

---

## Message Processing

### `messageProcessor.js`
**Purpose**: Builds and formats message arrays for AI consumption with LLM error filtering

**Key Functions**:
- `buildMessageArray(character, context, currentMessage)` - Creates message array with error filtering
- `validateMessageArray(messages)` - Validates message structure and alternating pattern
- `getMessageStats(messages)` - Provides detailed message statistics

**Key Features**:
- **BREAKING CHANGE**: Messages with `hasLLMError: true` are filtered before AI processing
- Tracks token savings from filtered LLM error messages
- Enhanced logging for debugging message flow
- Fallback to minimal message array on error
- Prevents AI confusion from error messages

**Dependencies**: `conversationFormatter.js`, `Character.generateSystemPrompt()`

---

### `conversationFormatter.js`
**Purpose**: Formats conversation history into AI-friendly patterns with LLM error filtering

**Key Functions**:
- `reorganizeToAlternatingPattern(chronologicalMessages)` - Creates alternating pattern and filters LLM errors
- `combineConsecutiveUserMessages(userMessages)` - Merges multiple user messages with numbering
- `handleCurrentMessageWithHistory(alternatingMessages, currentMessage)` - Integrates current message
- `validateConversationPattern(messages)` - Validates conversation structure
- `getConversationStats(messages)` - Analyzes conversation metrics

**LLM Error Filtering (BREAKING CHANGE)**:
- Filters out messages with `hasLLMError: true` flag before processing
- Logs token savings from filtered messages (lines 60-66)
- Maintains conversation flow after filtering
- Includes detailed debug logging for monitoring

**Dependencies**: Logger

---

### `responseCleanup.js` (NEW MODULE)
**Purpose**: Cleans AI responses by removing internal processing artifacts

**Key Functions**:
- `cleanAIResponse(response)` - Removes thinking tags and normalizes output
- `hasThinkingArtifacts(response)` - Detects presence of thinking process

**Thinking Tag Patterns Removed (8 patterns)**:
- `<think>...</think>`
- `<thinking>...</thinking>`
- `[thinking]...[/thinking]`
- `*thinking*...*/thinking*`
- `(thinking)...(/thinking)`
- `<!-- thinking...thinking -->`
- `<reasoning>...</reasoning>`
- `[reasoning]...[/reasoning]`

**Text Normalization**:
- Multiple line breaks to double
- Trim whitespace
- Remove indented empty lines
- Convert tabs to spaces
- Multiple spaces to single

**Dependencies**: Logger

---

## Content & Personality

### `contentFilter.js`
**Purpose**: Content safety and filtering

**Key Functions**:
- `filterContent(content)` - Checks for prohibited content
- `getFilteredResponseMessage(reason)` - Returns safe fallback messages
- Uses local pattern matching for content filtering

**Dependencies**: None

---

### `personalityEngine.js`
**Purpose**: Core personality application system

**Key Functions**:
- `applyPersonality(response, character)` - Main personality application
- Coordinates all personality modification functions
- Applies traits based on character configuration

**Dependencies**: `responsePersonalizer.js`

---

### `responsePersonalizer.js` (NEW MODULE)
**Purpose**: Specific personality modification functions

**Key Functions**:
- `addFlirtyTone(text, personality)` - Adds flirtatious elements with intensity control
- `addHumor(text, personality)` - Incorporates humor with style options (witty, playful, sarcastic, lighthearted)
- `addIntellectualDepth(text, personality)` - Adds sophisticated language and thoughtful phrases
- `adjustFormality(text, level)` - Modifies formality ('very_casual', 'casual', 'formal', 'very_formal')
- `addEmojis(text, personality)` - Intelligently adds personality-appropriate emojis
- `addPlayfulElements(text, personality)` - Adds playful interjections and endings
- `addMysteriousElements(text, personality)` - Creates mysterious atmosphere
- `addCompassionateElements(text, personality)` - Adds caring, empathetic language

**Formality Adjustments**:
- `very_casual`: u, what's, gonna, wanna, cuz
- `casual`: Contractions like it's, that's
- `formal`: Full words, no contractions
- `very_formal`: Formal vocabulary, "wish to" instead of "wanna"

**Dependencies**: Logger

---

## Utilities & Support

### `responseUtils.js` (NEW MODULE)
**Purpose**: Comprehensive utility functions for response quality assessment and processing

**Key Functions**:
- `isResponseIncomplete(response)` - Detects incomplete responses using pattern matching
  - Checks for proper sentence endings (punctuation or emoji)
  - Detects incomplete word patterns (then, and, but, etc.)
- `smartTruncate(response, maxLength)` - Intelligent text truncation at sentence boundaries
  - Preserves complete sentences when possible
  - Falls back to word boundaries with ellipsis
- `assessResponseQuality(response)` - Comprehensive quality assessment
  - Returns detailed metrics including score (0-1)
  - Checks completeness, length, repetition, coherence
- `assessRepetition(response)` - Detects repetitive content patterns
  - Word uniqueness ratio
  - Phrase repetition detection
- `assessCoherence(response)` - Evaluates response coherence and flow
  - Capitalization checking
  - Flow indicators detection
  - Abrupt ending detection
- `calculateReadability(response)` - Analyzes readability metrics
  - Word/sentence counts
  - Syllable counting
  - Readability score calculation
- `validateResponseStructure(response)` - Validates response format
  - Punctuation balance
  - Quote/parentheses matching
  - Sentence structure validation
- `getResponseMetrics(response)` - Complete response analysis combining all metrics

**Quality Assessment Object**:
```javascript
{
  isComplete: boolean,
  isTooLong: boolean,
  needsRetry: boolean,
  reason: string,
  characterCount: number,
  wordCount: number,
  sentenceCount: number,
  score: number // 0-1, higher is better
}
```

**Dependencies**: Logger

---

### `mediaHandler.js`
**Purpose**: Media processing and gallery management

**Key Functions**:
- `extractMediaSuggestion(text)` - Extracts explicit and implicit media suggestions from AI responses
- `selectMediaFromGallery(character, suggestion)` - Intelligent media selection from character gallery
- `validateMediaItem(mediaItem)` - Validates media item structure and format
- Internal sentiment analysis and emotion detection for media matching

**Dependencies**: None

---

### `cacheManager.js`
**Purpose**: Response pattern caching for consistency

**Key Functions**:
- `cacheResponsePattern(characterId, userMessage, aiResponse, metadata)` - Stores response patterns
- `getCachedPatterns(characterId, limit)` - Retrieves cached patterns for character
- `findSimilarResponses(characterId, userMessage, similarityThreshold)` - Finds similar cached responses
- `cacheConversationSummary(characterId, userId, summary)` - Caches conversation summaries
- `getCachedConversationSummary(characterId, userId)` - Retrieves conversation summaries
- `cacheModelMetrics(model, metrics)` - Caches AI model performance metrics
- `getCacheStats(characterId)` - Retrieves cache statistics for monitoring
- `clearCharacterCache(characterId)` - Clears all cache data for a character

**Dependencies**: Redis client

---

### `speechSynthesis.js`
**Purpose**: Text-to-speech integration (placeholder)

**Key Functions**:
- `synthesizeSpeech(text, voiceSettings)` - Converts text to speech (placeholder implementation)
- `getSupportedVoices(languageCode)` - Returns supported voice names for language
- `testTTSConnection()` - Tests TTS service connectivity and configuration
- `generateAudioMetadata(text, voiceSettings)` - Generates metadata for audio files
- Internal functions for voice validation, text preprocessing, and duration estimation

**Dependencies**: Google Cloud TTS (future implementation)

---

## Data Structures

### Response Object
```javascript
{
  content: string,           // Generated response text
  type: string,             // Response type ('text', 'audio', 'media')
  audioUrl?: string,        // Audio file URL (if type='audio')
  mediaItem?: object,       // Media object (if type='media')
  aiMetadata: {
    model: string,          // AI model used
    provider: string,       // Provider (deepseek/together)
    fallbackUsed: boolean,  // Whether fallback was used
    qualityControl: object, // Quality control metadata
    processingTime: number, // Generation time in ms
    tokens: object,         // Token usage info
    filtered: boolean,      // Whether content was filtered
    filterReason?: string   // Filter reason if applicable
  }
}
```

### Quality Assessment Object
```javascript
{
  isComplete: boolean,      // Response appears complete
  isTooLong: boolean,       // Response exceeds length limits
  needsRetry: boolean,      // Response should be retried
  reason: string,           // Reason for quality assessment
  characterCount: number,   // Character count
  wordCount: number,        // Word count
  sentenceCount: number,    // Number of sentences
  score: number            // Quality score 0-1
}
```

### LLM Error Object
```javascript
{
  error: true,
  errorType: 'llm_failure',
  isLLMError: true,         // Flag for queue processor detection
  provider: string,         // 'deepseek' or 'fallback'
  originalError: string,    // Original error message
  qualityControl: {
    attempts: number,       // Number of generation attempts
    failed: true,
    error: string
  },
  timestamp: number         // Error timestamp
}
```

## Error Handling Patterns

All modules follow consistent error handling:
1. Try-catch blocks around external API calls
2. Graceful fallbacks when possible
3. Detailed error logging with context
4. User-friendly error messages
5. No silent failures

## Testing Patterns

Each module should include:
- Unit tests for individual functions
- Mock external dependencies
- Test error conditions
- Validate input/output formats
- Performance benchmarks where applicable