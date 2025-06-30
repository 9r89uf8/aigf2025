/**
 * Response Types - Handles Different AI Response Types
 * 
 * This module contains generators for different types of AI responses:
 * text, audio, and media responses.
 */

import { generateWithQualityControl } from './qualityControl.js';
import { synthesizeSpeech } from './speechSynthesis.js';
import { extractMediaSuggestion, selectMediaFromGallery } from './mediaHandler.js';
import logger from '../../utils/logger.js';

/**
 * Generate text response with quality control, retries, and smart truncation
 * @param {Array} messages - Message array for AI
 * @param {Object} aiSettings - AI configuration settings
 * @param {Object} character - Character data
 * @returns {Promise<Object>} Generated text response
 */
export const generateTextResponse = async (messages, aiSettings, character) => {
  logger.debug('Generating text response', {
    messageCount: messages.length,
    characterId: character.id,
    model: aiSettings.model
  });

  // Use quality control system for text generation
  return await generateWithQualityControl(messages, aiSettings, character);
};

/**
 * Generate audio response (text + speech synthesis)
 * @param {Array} messages - Message array for AI
 * @param {Object} aiSettings - AI configuration settings
 * @param {Object} character - Character data
 * @returns {Promise<Object>} Generated audio response
 */
export const generateAudioResponse = async (messages, aiSettings, character) => {
  logger.debug('Generating audio response', {
    messageCount: messages.length,
    characterId: character.id,
    voiceSettings: character.voiceSettings
  });

  try {
    // First generate text response
    const textResponse = await generateTextResponse(messages, aiSettings, character);
    
    // Convert to speech
    const audioUrl = await synthesizeSpeech(textResponse.content, character.voiceSettings);
    
    logger.info('Audio response generated', {
      characterId: character.id,
      textLength: textResponse.content.length,
      audioGenerated: !!audioUrl,
      provider: textResponse.provider
    });
    
    return {
      content: textResponse.content,
      audioUrl,
      usage: textResponse.usage,
      provider: textResponse.provider,
      model: textResponse.model,
      fallbackUsed: textResponse.fallbackUsed,
      qualityControl: textResponse.qualityControl
    };
    
  } catch (error) {
    logger.error('Error generating audio response:', error);
    
    // Fallback to text-only response if TTS fails
    logger.warn('Falling back to text-only response due to TTS failure');
    const textResponse = await generateTextResponse(messages, aiSettings, character);
    
    return {
      ...textResponse,
      audioUrl: null,
      audioError: error.message
    };
  }
};

/**
 * Generate media response (text + suggested media)
 * @param {Array} messages - Message array for AI
 * @param {Object} aiSettings - AI configuration settings
 * @param {Object} character - Character data
 * @returns {Promise<Object>} Generated media response
 */
export const generateMediaResponse = async (messages, aiSettings, character) => {
  logger.debug('Generating media response', {
    messageCount: messages.length,
    characterId: character.id,
    gallerySize: character.gallery?.length || 0
  });

  try {
    // Modify the last message to request media suggestion
    const enhancedMessages = [...messages];
    const lastMessage = enhancedMessages[enhancedMessages.length - 1];
    
    enhancedMessages[enhancedMessages.length - 1] = {
      ...lastMessage,
      content: lastMessage.content + 
        '\n\nAlso suggest an appropriate image or GIF that would complement your response.'
    };
    
    // Generate text response with media suggestion
    const textResponse = await generateTextResponse(enhancedMessages, aiSettings, character);
    
    // Extract media suggestion from response
    const mediaSuggestion = extractMediaSuggestion(textResponse.content);
    
    // Get media from character gallery
    const mediaItem = await selectMediaFromGallery(character, mediaSuggestion);
    
    logger.info('Media response generated', {
      characterId: character.id,
      textLength: textResponse.content.length,
      mediaSuggestion: mediaSuggestion.type,
      mediaFound: !!mediaItem,
      provider: textResponse.provider
    });
    
    return {
      content: mediaSuggestion.caption || textResponse.content,
      mediaItem,
      usage: textResponse.usage,
      provider: textResponse.provider,
      model: textResponse.model,
      fallbackUsed: textResponse.fallbackUsed,
      qualityControl: textResponse.qualityControl,
      mediaSuggestion
    };
    
  } catch (error) {
    logger.error('Error generating media response:', error);
    
    // Fallback to text-only response if media processing fails
    logger.warn('Falling back to text-only response due to media processing failure');
    const textResponse = await generateTextResponse(messages, aiSettings, character);
    
    return {
      ...textResponse,
      mediaItem: null,
      mediaError: error.message
    };
  }
};