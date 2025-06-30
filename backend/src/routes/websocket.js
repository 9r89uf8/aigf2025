/**
 * WebSocket routes documentation
 * Documents all Socket.io events and their usage
 */
import { Router } from 'express';

const router = Router();

/**
 * Get WebSocket documentation
 * GET /websocket
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WebSocket API Documentation',
    connection: {
      url: `ws://localhost:${process.env.PORT || 3000}`,
      transports: ['websocket', 'polling'],
      auth: {
        token: 'Firebase ID token (required)',
        characterId: 'Initial character ID (optional)'
      }
    },
    events: {
      // Message events
      message: {
        send: {
          event: 'message:send',
          data: {
            characterId: 'string (required)',
            type: 'text | audio | media',
            content: 'string (for text messages)',
            audioData: 'object (for audio messages)',
            mediaData: 'object (for media messages)'
          },
          response: {
            success: 'boolean',
            message: 'object (saved message)',
            usage: 'object (updated usage stats)',
            error: 'string (on failure)'
          }
        },
        receive: {
          event: 'message:receive',
          data: {
            message: 'object',
            conversationId: 'string'
          },
          description: 'Received when new message arrives'
        },
        read: {
          event: 'message:read',
          data: {
            conversationId: 'string',
            messageIds: 'string[]'
          },
          response: {
            success: 'boolean',
            error: 'string (on failure)'
          }
        },
        status: {
          event: 'message:status',
          data: {
            conversationId: 'string',
            messageIds: 'string[]',
            status: 'read | error'
          },
          description: 'Message status updates'
        }
      },
      
      // Typing events
      typing: {
        start: {
          event: 'typing:start',
          data: {
            characterId: 'string'
          },
          description: 'Start typing indicator'
        },
        stop: {
          event: 'typing:stop',
          data: {
            characterId: 'string'
          },
          description: 'Stop typing indicator'
        }
      },
      
      // Conversation events
      conversation: {
        list: {
          event: 'conversation:list',
          data: {
            limit: 'number (optional, default: 20)',
            offset: 'number (optional, default: 0)'
          },
          response: {
            success: 'boolean',
            conversations: 'array',
            total: 'number',
            hasMore: 'boolean'
          }
        },
        messages: {
          event: 'conversation:messages',
          data: {
            conversationId: 'string',
            limit: 'number (optional, default: 50)',
            before: 'timestamp (optional)'
          },
          response: {
            success: 'boolean',
            messages: 'array',
            hasMore: 'boolean'
          }
        },
        search: {
          event: 'conversation:search',
          data: {
            conversationId: 'string',
            query: 'string'
          },
          response: {
            success: 'boolean',
            messages: 'array',
            count: 'number'
          }
        },
        stats: {
          event: 'conversation:stats',
          data: {
            conversationId: 'string'
          },
          response: {
            success: 'boolean',
            stats: 'object'
          }
        },
        join: {
          event: 'conversation:join',
          data: {
            characterId: 'string'
          },
          response: {
            success: 'boolean'
          }
        },
        leave: {
          event: 'conversation:leave',
          data: {
            characterId: 'string'
          },
          response: {
            success: 'boolean'
          }
        },
        delete: {
          event: 'conversation:delete',
          data: {
            conversationId: 'string'
          },
          response: {
            success: 'boolean'
          }
        }
      },
      
      // Character events
      character: {
        subscribe: {
          event: 'character:subscribe',
          data: {
            characterId: 'string'
          },
          description: 'Subscribe to character updates'
        },
        unsubscribe: {
          event: 'character:unsubscribe',
          data: {
            characterId: 'string'
          },
          description: 'Unsubscribe from character updates'
        },
        update: {
          event: 'character:update',
          data: {
            characterId: 'string',
            update: 'object',
            timestamp: 'date'
          },
          description: 'Received when character is updated'
        }
      },
      
      // User events
      user: {
        status: {
          event: 'user:status',
          data: {
            status: 'online | away | offline'
          },
          description: 'Update user status'
        }
      },
      
      // System events
      system: {
        notification: {
          event: 'system:notification',
          data: {
            event: 'string',
            data: 'object',
            timestamp: 'date'
          },
          description: 'System notifications'
        },
        ping: {
          event: 'ping',
          response: {
            success: 'boolean',
            timestamp: 'number'
          },
          description: 'Connection health check'
        }
      },
      
      // Error events
      errors: {
        auth: {
          event: 'auth:error',
          data: {
            error: 'string'
          },
          description: 'Authentication errors'
        },
        rateLimit: {
          event: 'rate:limit',
          data: {
            error: 'string'
          },
          description: 'Rate limit exceeded'
        },
        usageLimit: {
          event: 'usage:limit',
          data: {
            characterId: 'string',
            messageType: 'string',
            limit: 'number',
            used: 'number',
            resetAt: 'date'
          },
          description: 'Usage limit reached'
        }
      }
    },
    example: {
      connection: `
// Client-side example
const socket = io('ws://localhost:3000', {
  auth: {
    token: firebaseIdToken,
    characterId: 'character123'
  }
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
      `,
      sendMessage: `
// Send a text message
socket.emit('message:send', {
  characterId: 'character123',
  type: 'text',
  content: 'Hello AI!'
}, (response) => {
  if (response.success) {
    console.log('Message sent:', response.message);
  } else {
    console.error('Failed to send:', response.error);
  }
});
      `,
      receiveMessage: `
// Listen for incoming messages
socket.on('message:receive', (data) => {
  console.log('New message:', data.message);
});
      `
    }
  });
});

export default router; 