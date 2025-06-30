# AI Service Architecture

The AI Service is responsible for generating AI responses for character conversations. It has been refactored from a single monolithic file into focused, maintainable modules.

## Overview

The AI Service handles:
- AI response generation using DeepSeek with Together.ai fallback
- Message formatting and conversation context management
- Response quality control and retry logic with smart truncation
- Content filtering and safety checks with spam detection
- Character personality application with trait-based customization
- Media handling with intelligent suggestion extraction
- Speech synthesis integration (placeholder for Google Cloud TTS)
- Response pattern caching for consistency
- Token optimization through LLM error message filtering
- Structured error handling for provider failures


## Quick Start

```javascript
import { generateAIResponse } from './services/aiService/index.js';

try {
  const response = await generateAIResponse({
    conversationId: 'conv_123',
    userId: 'user_456', 
    characterId: 'char_789',
    message: { content: 'Hello!' },
    responseType: 'text' // 'text', 'audio', or 'media'
  });

  console.log(response.content); // AI response
  console.log(response.aiMetadata); // Generation metadata
} catch (error) {
  if (error.isLLMError) {
    // LLM provider failure - handle with queue processor
    console.log('LLM providers failed:', error.errorType);
    console.log('Original error:', error.originalError);
    // Queue processor will handle database update and WebSocket events
  } else {
    // Other errors - handle normally
    console.error('AI service error:', error.message);
  }
}
```

## Module Structure

### Core Modules

- **`index.js`** - Main entry point and public API
- **`responseGenerator.js`** - Orchestrates the entire response generation process
- **`responseTypes.js`** - Handles different response types (text, audio, media)
- **`qualityControl.js`** - Quality assessment, retry logic, and smart truncation

### Message Processing

- **`messageProcessor.js`** - Builds message arrays for AI consumption
- **`conversationFormatter.js`** - Formats conversation history into alternating patterns
- **`responseCleanup.js`** - Cleans AI responses by removing thinking process

### Content & Personality

- **`contentFilter.js`** - Content safety filtering and prohibited content checks
- **`personalityEngine.js`** - Applies character personality traits to responses
- **`responsePersonalizer.js`** - Specific personality functions (flirty, humor, etc.)

### Utilities & Support

- **`responseUtils.js`** - Utility functions for response processing
- **`mediaHandler.js`** - Media suggestion extraction and gallery selection
- **`cacheManager.js`** - Response pattern caching for consistency
- **`speechSynthesis.js`** - Text-to-speech integration (placeholder)

## Data Flow

1. **Request Received** → `responseGenerator.js`
2. **Character & Context** → Retrieved from services
3. **Message Processing** → `messageProcessor.js` → `conversationFormatter.js`
4. **AI Generation** → `responseTypes.js` → DeepSeek/Together.ai
5. **Quality Control** → `qualityControl.js` → Retry if needed
6. **Response Cleanup** → `responseCleanup.js` → Remove thinking process
7. **Content Filtering** → `contentFilter.js` → Safety checks
8. **Personality Application** → `personalityEngine.js` → Character traits
9. **Final Response** → Returned to caller

## Key Features

### Fallback System
- Primary: DeepSeek API with `deepseek-reasoner` model (forced, ignores character settings)
- Fallback: Together.ai with multiple model options
- Graceful degradation when services are unavailable
- **Note**: OpenAI has been completely removed from the service

### Quality Control
- Incomplete response detection
- Smart truncation at sentence boundaries
- Retry logic with brevity prompts
- Response length and quality assessment

### Personality Engine
- Character trait application (flirty, funny, intellectual)
- Formality level adjustment
- Emoji insertion based on personality
- Tone modification functions

### Content Safety
- Local content filtering with prohibited patterns
- Fallback messages for blocked content
- Safety-first approach to user interactions

### Token Optimization
- LLM error messages automatically filtered from AI context
- Reduces token usage by excluding failed messages
- Prevents AI confusion from error messages
- Token savings tracked in logs

## Configuration

All AI models and settings are configured in:
- `../config/deepseek.js` - DeepSeek configuration
- `../config/together.js` - Together.ai fallback configuration

## Error Handling

- **LLM Provider Failures**: When DeepSeek and Together.ai both fail, throws structured error objects instead of fallback messages
- **Error Metadata**: LLM errors include `isLLMError: true` flag for proper handling by queue processors  
- **Database Persistence**: LLM error state persisted to user messages for UI consistency after page refresh
- **Graceful Degradation**: Non-LLM errors still use traditional fallback messages
- **Comprehensive Logging**: All error types logged with context for debugging and monitoring
- **Retry Mechanisms**: Quality control retries with enhanced brevity prompts before declaring failure

### LLM Error Object Structure
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

### Error Flow Behavior
- **LLM Errors**: Throw structured error objects → Queue processor handles → Database update + WebSocket event → Frontend error display
- **Other Errors**: Traditional error messages → AI response with error content → Normal message flow

## Performance Considerations

- Response caching for consistency
- Efficient message pattern optimization
- Smart truncation to prevent over-length responses
- Connection pooling for external APIs

## Testing Requirements

Each module should be tested independently:
- Unit tests for individual functions
- Integration tests for module interactions
- End-to-end tests for complete response generation
- Performance tests for response times

## Development Guidelines

1. **Single Responsibility**: Each module has one clear purpose
2. **Loose Coupling**: Modules interact through well-defined interfaces
3. **Error Handling**: All functions handle errors gracefully
4. **Logging**: Comprehensive logging for debugging and monitoring
5. **Documentation**: Clear JSDoc comments for all functions


## Future Enhancements

- Enhanced personality traits and behaviors
- Advanced content filtering with ML models
- Voice cloning for speech synthesis
- Real-time response streaming
- A/B testing for response quality