/**
 * Conversation routes
 * REST API endpoints for conversation management
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { redisRateLimiter } from '../middleware/redisRateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getOrCreateConversation,
  getUserConversations,
  getConversationById,
  getMessages,
  addMessage,
  deleteConversation,
  searchMessages,
  getConversationStats,
  canSendMessage
} from '../services/conversationService.js';
import { getCharacterById } from '../services/characterService.js';
import { incrementUsage } from '../services/usageService.js';
import { validateMessage } from '../models/Conversation.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Get user conversations
 * GET /api/conversations
 */
router.get('/', 
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await getUserConversations(req.user.uid, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      ...result
    });
  })
);

/**
 * Get or create conversation
 * POST /api/conversations
 */
router.post('/',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { characterId } = req.body;
    
    if (!characterId) {
      return res.status(400).json({
        success: false,
        error: 'Character ID required'
      });
    }
    
    // Verify character exists
    const character = await getCharacterById(characterId);
    if (!character) {
      return res.status(404).json({
        success: false,
        error: 'Character not found'
      });
    }
    
    const conversation = await getOrCreateConversation(req.user.uid, characterId);
    
    res.json({
      success: true,
      conversation
    });
  })
);

/**
 * Get conversation by ID
 * GET /api/conversations/:conversationId
 */
router.get('/:conversationId',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    
    // Verify user owns the conversation
    const [userId] = conversationId.split('_');
    if (userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    const conversation = await getConversationById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    
    res.json({
      success: true,
      conversation
    });
  })
);

/**
 * Get conversation messages
 * GET /api/conversations/:conversationId/messages
 */
router.get('/:conversationId/messages',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;
    
    // Verify user owns the conversation
    const [userId] = conversationId.split('_');
    if (userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    const result = await getMessages(conversationId, {
      limit: parseInt(limit),
      before
    });
    
    res.json({
      success: true,
      ...result
    });
  })
);

/**
 * Send message (alternative to WebSocket)
 * POST /api/conversations/:conversationId/messages
 */
router.post('/:conversationId/messages',
  authenticate,
  redisRateLimiter.messages,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { type = 'text', content, audioData, mediaData, messageId } = req.body;
    
    // Verify user owns the conversation
    const [userId, characterId] = conversationId.split('_');
    if (userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Check usage limits
    const usage = await canSendMessage(
      req.user.uid,
      characterId,
      type,
      req.user.isPremium
    );
    
    if (!usage.canSend) {
      return res.status(429).json({
        success: false,
        error: 'Message limit reached',
        usage
      });
    }
    
    // Create and validate message
    const message = {
      sender: 'user',
      type,
      content: type === 'text' ? content : null,
      audioData: type === 'audio' ? audioData : null,
      mediaData: type === 'media' ? mediaData : null
    };
    
    const validation = validateMessage(message);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(', ')
      });
    }
    
    // Add message with predefined ID if provided
    const savedMessage = await addMessage(conversationId, message, null, messageId);
    
    // Increment Redis usage tracking for rate limiting and display
    try {
      await incrementUsage(req.user.uid, characterId, type);
      logger.debug('Redis usage incremented', { userId: req.user.uid, characterId, type });
    } catch (usageError) {
      logger.error('Failed to increment Redis usage (non-blocking):', usageError);
      // Don't fail the request if Redis usage tracking fails
    }
    
    logger.info('Message sent via REST API', {
      userId: req.user.uid,
      conversationId,
      messageId: savedMessage.id,
      type
    });
    
    res.json({
      success: true,
      message: savedMessage,
      usage: {
        ...usage,
        used: usage.used + 1,
        remaining: usage.remaining - 1
      }
    });
  })
);

/**
 * Search messages in conversation
 * GET /api/conversations/:conversationId/search
 */
router.get('/:conversationId/search',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query required'
      });
    }
    
    // Verify user owns the conversation
    const [userId] = conversationId.split('_');
    if (userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    const messages = await searchMessages(conversationId, query);
    
    res.json({
      success: true,
      messages,
      count: messages.length
    });
  })
);

/**
 * Get conversation statistics
 * GET /api/conversations/:conversationId/stats
 */
router.get('/:conversationId/stats',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    
    // Verify user owns the conversation
    const [userId] = conversationId.split('_');
    if (userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    const stats = await getConversationStats(conversationId);
    
    res.json({
      success: true,
      stats
    });
  })
);

/**
 * Like/unlike a message
 * POST /api/conversations/:conversationId/messages/:messageId/like
 */
router.post('/:conversationId/messages/:messageId/like',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { conversationId, messageId } = req.params;
    const { isLiked } = req.body;
    
    // Verify user owns the conversation
    const [userId] = conversationId.split('_');
    if (userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Import here to avoid circular dependencies
    const { likeMessage } = await import('../services/conversationService.js');
    
    await likeMessage(conversationId, messageId, req.user.uid, isLiked);
    
    logger.info('Message like updated', {
      userId: req.user.uid,
      conversationId,
      messageId,
      isLiked
    });
    
    res.json({
      success: true,
      isLiked
    });
  })
);

/**
 * Delete conversation
 * DELETE /api/conversations/:conversationId
 */
router.delete('/:conversationId',
  authenticate,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    
    // Verify user owns the conversation
    const [userId] = conversationId.split('_');
    if (userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    await deleteConversation(conversationId);
    
    logger.info('Conversation deleted', {
      userId: req.user.uid,
      conversationId
    });
    
    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  })
);

export default router; 