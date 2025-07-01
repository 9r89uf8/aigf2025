# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered messaging platform where users can chat with virtual AI characters. The application consists of a Node.js/Express backend with real-time WebSocket communication and a Next.js frontend with Firebase authentication.

## Development Commands

### Backend Commands (from `backend/` directory)
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run seed` - Seed database with test data
- `npm run seed:clean` - Clean test data
- `npm run env:generate` - Generate environment file template
- `npm run check:env` - Validate environment variables
- `npm run check:health` - Check API health (requires curl and jq)

### Frontend Commands (from `frontend/` directory)
- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Architecture Overview

### Backend Architecture
- **Express.js** with ES modules (type: "module")
- **Modular structure** with services, routes, middleware, and models
- **Firebase Admin SDK** for authentication and database
- **Socket.io** for real-time messaging
- **Bull queues** with Redis for background job processing
- **OpenAI integration** for AI character responses
- **Stripe** for payment processing
- **Google Cloud Storage** for media uploads

### Key Backend Services
- `aiService.js` - Handles OpenAI API calls and AI response generation
- `conversationStateService.js` - Manages conversation state, message queuing, and processing coordination
- `characterService.js` - Character management and personality traits
- `userService.js` - User profile and usage tracking
- `paymentService.js` - Stripe integration for premium subscriptions
- `mediaService.js` - File upload and processing
- `cacheService.js` - Redis caching layer
- `healthService.js` - Comprehensive health monitoring



### AI Service Documentation
**IMPORTANT**: The aiService has comprehensive documentation that should be consulted whenever working with AI response generation:

- **Always check `backend/src/services/aiService/docs/` first** before making changes
- **Key documentation files**:
  - `AI_SERVICE_ARCHITECTURE.md` - Complete architecture overview, module interactions, data flow patterns, and scalability considerations
  - `FLOW_DIAGRAMS.md` - Visual flow diagrams for response generation, quality control, fallback systems, and error handling
  - `MODULE_REFERENCE.md` - Detailed reference for each module with functions, dependencies, and data structures
- **Also reference `backend/src/services/aiService/README.md`** for quick overview and usage examples
- **When making changes**: Update corresponding documentation files if changes break existing flow or add new functionality to keep docs up to date

### Conversation State Service Documentation
**IMPORTANT**: The conversationStateService has comprehensive documentation that should be consulted whenever working with conversation state management:

- **Always check `backend/src/services/conversationStateService/docs/` first** before making changes
- **Key documentation files**:
  - `ARCHITECTURE.md` - System design, component responsibilities, data flows, and Redis schema
  - `FLOW_DIAGRAMS.md` - Visual flow diagrams for message queuing, state transitions, and WebSocket integration
  - `API_REFERENCE.md` - Complete function reference with parameters, examples, and error codes
- **Also reference `backend/src/services/conversationStateService/README.md`** for quick overview and module structure
- **When making changes**: Update corresponding documentation files if changes break existing flow or add new functionality to keep docs up to date

### Frontend Architecture
- **Next.js 15** with App Router
- **Zustand** for state management
- **Firebase SDK** for client-side authentication
- **Socket.io Client** for real-time communication
- **Tailwind CSS** for styling
- **Axios** for API calls with interceptors

### Key Frontend Stores
- `authStore.js` - User authentication and premium status
- `characterStore.js` - Character data and filtering
- `chatStore.js` - Real-time messaging state
- `usageStore.js` - Usage tracking and limits

## API Endpoints Structure

The backend provides a comprehensive REST API with the following main routes:
- `/health/*` - Health checks and monitoring
- `/api/auth/*` - Authentication and user management
- `/api/characters/*` - Character browsing and profiles
- `/api/conversations/*` - Messaging and conversation management
- `/api/payments/*` - Stripe payment processing
- `/api/media/*` - File upload and media handling
- `/api/ai/*` - AI service management
- `/api/webhooks/*` - External webhooks (Stripe)

## WebSocket Events

Real-time communication uses Socket.io with these key events:
- `message:send` / `message:receive` - Message exchange
- `message:typing` - Typing indicators
- `conversation:join` - Join conversation rooms
- `usage:update` - Real-time usage tracking

## Key Technical Details

### Authentication Flow
1. Firebase Auth handles user registration/login
2. Firebase ID tokens are sent to backend for verification
3. Backend creates/updates user profiles in Firebase
4. Frontend stores user state in Zustand auth store
5. API calls include Bearer tokens via Axios interceptors

### Usage Tracking System
- Free users: 30 text messages, 5 image uploads, 5 audio messages
- Premium users: Unlimited usage
- Real-time usage updates via WebSocket
- Redis-based rate limiting per user

### Payment Integration
- Stripe Checkout for premium subscriptions
- Premium status stored in Firebase user documents
- Webhook handling for subscription events
- 15-day premium subscription model

### Media Handling
- Google Cloud Storage for file uploads
- Sharp for image processing and optimization
- Multiple image sizes generated (thumbnail, medium, full)
- File validation and security checks

## Environment Configuration

### Backend Environment Variables
Key variables that must be configured:
- `FIREBASE_*` - Firebase Admin SDK credentials
- `OPENAI_API_KEY` - OpenAI API access
- `STRIPE_*` - Stripe payment keys
- `REDIS_*` - Redis connection settings
- `GOOGLE_CLOUD_*` - GCS storage credentials

### Frontend Environment Variables
- `NEXT_PUBLIC_API_URL` - Backend API endpoint
- `NEXT_PUBLIC_FIREBASE_CONFIG` - Firebase client config
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `NEXT_PUBLIC_SOCKET_URL` - WebSocket server URL

## Testing Strategy

### Backend Testing
- Jest configuration with ES modules support
- Test files in `src/__tests__/` directory
- Integration tests for API endpoints
- Service-level unit tests
- 10-second test timeout for async operations

### Frontend Testing
- Next.js built-in ESLint configuration
- Component and integration testing planned
- Zustand store testing

## Code Standards

### From .cursor/rules/my-custom-rules.mdc
- Keep files under 300 lines
- Use modern ES6+ syntax
- Implement proper error handling
- Write self-documenting code
- Use functional programming concepts
- Prefer const/let over var
- Check for CommonJS/ES modules syntax mismatches

### Security Considerations
- Helmet.js for security headers
- CORS configuration
- Rate limiting with Redis
- Input validation and sanitization
- Firebase security rules
- JWT token validation

## Development Phases

The frontend follows a 10-phase development plan:
1. Core Setup and Configuration
2. Authentication System
3. Character Discovery System
4. Real-time Chat Interface
5. Payment Integration
6. Media Upload System
7. Usage Analytics & Profile
8. Performance & Polish
9. Testing & Documentation
10. Deployment & Monitoring

## Deployment Considerations

### Health Checks
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe
- `/health/detailed` - Comprehensive service status

### Scaling
- Redis for session management
- Horizontal scaling supported
- Queue workers can run separately
- WebSocket sticky sessions required

## Common Patterns

### Error Handling
- Centralized error handling middleware
- Structured logging with Winston
- User-friendly error messages
- Proper HTTP status codes

### State Management
- Zustand for frontend state
- Redis for backend caching
- Firebase for persistent data
- Optimistic updates in chat

### Performance Optimization
- Image optimization with Sharp
- Lazy loading for character galleries
- Debounced search inputs
- Connection pooling for Redis
- Caching strategies throughout

## File Structure Notes

- Backend uses ES modules exclusively
- Frontend uses Next.js App Router structure
- Configuration files are in respective `config/` directories
- Shared utilities in `utils/` directories
- Test files follow `__tests__/` convention



The frontend chat store has been refactored from a single 1481-line file into a modular architecture for better maintainability:

### New Structure
```
frontend/stores/
├── chat/
│   ├── index.js                    # Main export
│   ├── store.js                    # Combined store (29 lines)
│   ├── chatStore.original.backup.js # Backup of original (delete after testing)
│   ├── slices/
│   │   ├── socketSlice.js          # Socket connection management (96 lines)
│   │   ├── messageSlice.js         # Message CRUD operations (471 lines)
│   │   ├── messageLikesSlice.js    # Like functionality (132 lines)
│   │   ├── conversationSlice.js    # Conversation management (137 lines)
│   │   ├── conversationMessagesSlice.js # Message loading (158 lines)
│   │   ├── queueSlice.js           # Queue management (178 lines)
│   │   ├── usageSlice.js           # Usage tracking (137 lines)
│   │   └── typingSlice.js          # Typing indicators (48 lines)
│   ├── handlers/
│   │   └── socketEventHandlers.js  # All socket event handlers (94 lines)
│   └── utils/
│       └── messageUtils.js         # Message utilities (47 lines)
├── chatStore.js                    # Re-exports for backward compatibility
├── authStore.js
└── characterStore.js
```

### Slice Responsibilities
- **socketSlice**: WebSocket connection, initialization, cleanup
- **messageSlice**: Send/receive messages, status updates, retry logic, LLM errors
- **messageLikesSlice**: Like/unlike messages, AI likes handling
- **conversationSlice**: Join/leave conversations, create conversations
- **conversationMessagesSlice**: Load messages from API/WebSocket
- **queueSlice**: Message queue status, processing state
- **usageSlice**: Character usage limits and tracking
- **typingSlice**: Typing indicators


### Documentation
Comprehensive documentation is available in `frontend/stores/chat/` for the frontend chat store:
- **[docs/INDEX.md](frontend/stores/chat/docs/INDEX.md)** - Start here for navigation
- **[README.md](frontend/stores/chat/README.md)** - Architecture overview and slice details
- **[FLOW_DIAGRAMS.md](frontend/stores/chat/FLOW_DIAGRAMS.md)** - Visual flow diagrams
- **[QUICK_REFERENCE.md](frontend/stores/chat/QUICK_REFERENCE.md)** - Code snippets and examples
- **[ARCHITECTURE_DECISIONS.md](frontend/stores/chat/ARCHITECTURE_DECISIONS.md)** - ADRs explaining design choices

## Performance Optimization

### Firebase Operations Optimization (COMPLETED)
The system has been optimized to reduce Firebase operations from 9-11 per message to 1-2 per message:

#### Key Components:
- **Message Batching** (`messageBatcher.js`): Groups multiple operations into single batch commits
- **Stats Synchronization** (`statsSync.js`): Uses Redis counters with periodic sync to Firebase
- **Context Caching** (`contextManager.js`): Multi-layer caching (Memory → Redis → Firebase)
- **Write-Behind Pattern** (`writeBehindProcessor.js`): Defers non-critical updates
- **Monitoring & Fallback** (`fallbackService.js`): Automatic fallback to direct writes if issues occur

#### Results:
- **90% reduction** in Firebase operations
- **75% faster** response times (50-100ms vs 200-400ms)
- **91% cost savings** on Firebase usage
- **95%+ cache hit rate** for conversation contexts

#### Documentation:
- **`FIREBASE_OPTIMIZATION_PLAN.md`** - Complete implementation details
- **`FIREBASE_OPTIMIZATION_SUMMARY.md`** - Results and metrics

#### Monitoring:
- **Admin Dashboard**: `/api/monitoring/optimization`
- **Buffer Status**: `/api/monitoring/buffers`
- **Metrics**: `/api/monitoring/metrics`
- **Force Flush**: `POST /api/monitoring/force-flush`

#### Configuration:
```bash
REDIS_ENABLE_BATCHING=true        # Toggle optimization on/off
REDIS_BATCH_FLUSH_INTERVAL=60000  # Batch interval (ms) - Optimized for human conversations
REDIS_BATCH_MAX_SIZE=400          # Max operations per batch
REDIS_STATS_SYNC_INTERVAL=60000   # Stats sync interval (ms)
```

#### Recent Optimizations:
- **Batch Window Optimization**: Increased from 5s to 60s for better human conversation patterns
- **See**: `FIREBASE_BATCH_WINDOW_OPTIMIZATION_PLAN.md` for detailed analysis and implementation

When working with messaging operations, the optimization is automatic. Direct Firebase writes will fallback gracefully if Redis is unavailable.

### Firebase Monitoring Dashboard (COMPLETED)
**Goal**: Web UI dashboard for monitoring Firebase optimization metrics

#### Access
- **URL**: `/admin/monitoring` (Admin access required)
- **Entry Point**: Admin Dashboard → Firebase Optimization button

#### Features
1. **Overview Tab**: Key metrics, cost savings, buffer utilization
2. **Buffers Tab**: Detailed buffer status with health indicators
3. **Metrics Tab**: Searchable/sortable metrics table with CSV export
4. **Health Tab**: System health status and service monitoring
5. **Controls Tab**: Admin actions (force flush, reset metrics, toggle fallback)

#### Key Capabilities
- **Real-time Updates**: Auto-refresh every 30 seconds
- **Mobile Responsive**: Optimized for all screen sizes
- **Keyboard Shortcuts**: Press 1-5 for tabs, Ctrl+R to refresh
- **Quick Stats**: Summary cards at the top of dashboard
- **Alert System**: Visual warnings for critical issues
- **Help Tooltips**: Contextual help throughout the UI

#### Implementation Details
- **Plan**: See `FIREBASE_MONITORING_DASHBOARD_PLAN.md` for architecture
- **Frontend Components**: Located in `frontend/components/admin/monitoring/`
- **State Management**: Uses `monitoringStore.js` with Zustand
- **API Integration**: `frontend/lib/api/monitoring.js`

#### Admin Actions
- **Force Flush**: Immediately write all buffered operations
- **Reset Metrics**: Clear all optimization counters
- **Toggle Fallback**: Switch between optimized and direct-write modes

## Current Development Priority






