/**
 * AI routes
 * Endpoints for AI configuration and testing
 */
import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { redisRateLimiter } from '../middleware/redisRateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { 
  isDeepSeekConfigured, 
  getModelInfo, 
  AI_MODELS, 
  calculateTokenCost 
} from '../config/deepseek.js';
import { generateAIResponse } from '../services/aiService.js';
import { getCharacterById } from '../services/characterService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Get AI configuration status
 * GET /api/ai/status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const isConfigured = isDeepSeekConfigured();
  
  res.json({
    success: true,
    configured: isConfigured,
    models: isConfigured ? Object.keys(AI_MODELS) : [],
    features: {
      text: isConfigured,
      audio: false, // TTS not implemented yet
      media: isConfigured,
      contentFiltering: isConfigured
    }
  });
}));

/**
 * Get available AI models
 * GET /api/ai/models
 */
router.get('/models', 
  authenticate,
  asyncHandler(async (req, res) => {
    const models = Object.entries(AI_MODELS).map(([key, modelId]) => ({
      key,
      modelId,
      ...getModelInfo(modelId)
    }));
    
    res.json({
      success: true,
      models,
      default: AI_MODELS.DEEPSEEK_REASONER
    });
  })
);

/**
 * Test AI response generation (Admin only)
 * POST /api/ai/test
 */
router.post('/test',
  authenticate,
  requireAdmin,
  redisRateLimiter.api,
  asyncHandler(async (req, res) => {
    const { characterId, message, responseType = 'text' } = req.body;
    
    if (!characterId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Character ID and message required'
      });
    }
    
    if (!isDeepSeekConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'AI service not configured'
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
    
    // Create test conversation ID
    const testConversationId = `test_${req.user.uid}_${characterId}`;
    
    // Generate response
    const startTime = Date.now();
    const response = await generateAIResponse({
      conversationId: testConversationId,
      userId: req.user.uid,
      characterId,
      message: {
        id: 'test',
        sender: 'user',
        type: 'text',
        content: message,
        timestamp: new Date()
      },
      responseType
    });
    
    const processingTime = Date.now() - startTime;
    
    logger.info('AI test response generated', {
      characterId,
      responseType,
      processingTime,
      model: response.aiMetadata?.model
    });
    
    res.json({
      success: true,
      response: response.content,
      responseType: response.type,
      audioUrl: response.audioUrl,
      mediaItem: response.mediaItem,
      metadata: {
        ...response.aiMetadata,
        processingTime,
        testMode: true
      }
    });
  })
);

/**
 * Calculate token cost estimate
 * POST /api/ai/estimate-cost
 */
router.post('/estimate-cost',
  authenticate,
  asyncHandler(async (req, res) => {
    const { text, model = AI_MODELS.DEEPSEEK_REASONER } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text required for estimation'
      });
    }
    
    // Rough estimation: 1 token ≈ 4 characters
    const estimatedTokens = Math.ceil(text.length / 4);
    const modelInfo = getModelInfo(model);
    
    // Estimate assuming 1:1 input/output ratio
    const estimatedCost = calculateTokenCost(
      estimatedTokens,
      estimatedTokens,
      model
    );
    
    res.json({
      success: true,
      estimation: {
        textLength: text.length,
        estimatedInputTokens: estimatedTokens,
        estimatedOutputTokens: estimatedTokens,
        model: modelInfo.name,
        estimatedCost,
        costPer1000Tokens: modelInfo.costPer1kTokens
      },
      disclaimer: 'This is a rough estimate. Actual costs may vary.'
    });
  })
);

/**
 * Get AI usage statistics (Admin only)
 * GET /api/ai/usage
 */
router.get('/usage',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    // TODO: Implement usage aggregation from Redis
    
    res.json({
      success: true,
      usage: {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        byModel: {},
        byCharacter: {}
      },
      period: {
        start: startDate || 'all-time',
        end: endDate || 'now'
      }
    });
  })
);

/**
 * Update character AI settings (Admin only)
 * PUT /api/ai/characters/:characterId/settings
 */
router.put('/characters/:characterId/settings',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { characterId } = req.params;
    const { 
      model, 
      temperature, 
      maxTokens,
      systemPromptOverride,
      knowledgeBase
    } = req.body;
    
    // Get character
    const character = await getCharacterById(characterId);
    if (!character) {
      return res.status(404).json({
        success: false,
        error: 'Character not found'
      });
    }
    
    // Update AI settings
    const updatedSettings = {
      ...character.aiSettings,
      ...(model && { model }),
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
      ...(systemPromptOverride && { systemPromptOverride }),
      ...(knowledgeBase && { knowledgeBase })
    };
    
    // TODO: Implement character update
    
    res.json({
      success: true,
      message: 'AI settings updated',
      settings: updatedSettings
    });
  })
);

export default router; 