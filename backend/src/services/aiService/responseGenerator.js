/**
 * Response Generator - Main AI Response Orchestration
 * 
 * This module orchestrates the entire AI response generation process,
 * coordinating all other modules to produce the final response.
 */

import { getCharacterById } from '../characterService.js';
import { getConversationContext } from '../conversationService.js';
import { buildMessageArray } from './messageProcessor.js';
import { generateTextResponse, generateAudioResponse, generateMediaResponse } from './responseTypes.js';
import { filterContent, getFilteredResponseMessage } from './contentFilter.js';
import { cacheResponsePattern } from './cacheManager.js';
import { DEFAULT_AI_SETTINGS } from '../../config/deepseek.js';
import logger from '../../utils/logger.js';

/**
 * Generate AI response for a message
 * @param {Object} params - Generation parameters
 * @returns {Promise<Object>} AI response
 */
export const generateAIResponse = async ({
  conversationId,
  userId,
  characterId,
  message,
  responseType = 'text'
}) => {
  try {
    const startTime = Date.now();
    
    // Get character data
    const character = await getCharacterById(characterId);
    if (!character) {
      throw new Error('Character not found');
    }
    
    // Get conversation context
    const context = await getConversationContext(conversationId, {
      maxMessages: 20,
      includeSystemPrompt: true
    });
    
    // Build messages array for AI
    const messages = await buildMessageArray(character, context, message);
    
    // Get AI settings - force DeepSeek model regardless of character settings
    const aiSettings = {
      ...DEFAULT_AI_SETTINGS,
      ...character.aiSettings,
      model: 'deepseek-reasoner' // Always use DeepSeek model
    };
    
    // Generate response based on type
    let response;
    switch (responseType) {
      case 'text':
        response = await generateTextResponse(messages, aiSettings, character);
        break;
      case 'audio':
        response = await generateAudioResponse(messages, aiSettings, character);
        break;
      case 'media':
        response = await generateMediaResponse(messages, aiSettings, character);
        break;
      default:
        throw new Error(`Unsupported response type: ${responseType}`);
    }
    
    // Filter content
    const filtered = await filterContent(response.content);
    if (filtered.blocked) {
      logger.warn('Content blocked by filter', { 
        characterId, 
        reason: filtered.reason 
      });
      response.content = getFilteredResponseMessage(filtered.reason);
    }
    
    // Calculate metrics
    const processingTime = Date.now() - startTime;
    const metadata = {
      model: response.model || aiSettings.model,
      provider: response.provider || 'deepseek',
      fallbackUsed: response.fallbackUsed || false,
      qualityControl: response.qualityControl || {},
      processingTime,
      tokens: response.usage || {},
      filtered: filtered.blocked,
      filterReason: filtered.reason
    };
    
    // Cache response pattern for consistency
    await cacheResponsePattern(characterId, message.content, response.content);
    
    logger.info('AI response generated', {
      conversationId,
      characterId,
      responseType,
      processingTime,
      model: response.model || aiSettings.model,
      provider: response.provider || 'deepseek',
      fallbackUsed: response.fallbackUsed || false,
      qualityControl: response.qualityControl || {}
    });
    
    return {
      content: response.content,
      type: responseType,
      audioUrl: response.audioUrl,
      mediaItem: response.mediaItem,
      aiMetadata: metadata
    };
    
  } catch (error) {
    logger.error('Error generating AI response:', error);
    
    // If this is an LLM error object from qualityControl, preserve it
    if (error && typeof error === 'object' && error.isLLMError === true) {
      throw error; // Pass through LLM error metadata
    }
    
    throw error;
  }
};