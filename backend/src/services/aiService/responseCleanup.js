/**
 * Response Cleanup - AI Response Cleaning and Thinking Process Removal
 * 
 * This module handles cleaning AI responses by removing internal processing
 * artifacts like thinking tags and normalizing the output for users.
 */

import logger from '../../utils/logger.js';

/**
 * Clean AI response by removing thinking process and returning only final message
 * @param {string} response - Raw AI response
 * @returns {string} Cleaned response ready for user
 */
export const cleanAIResponse = (response) => {
  if (!response || typeof response !== 'string') {
    logger.warn('Invalid response passed to cleanAIResponse', {
      responseType: typeof response,
      responseLength: response?.length || 0
    });
    return response;
  }
  
  // Remove thinking tags and content - handles various formats
  const thinkingPatterns = [
    /<think>[\s\S]*?<\/think>/gi,           // <think>...</think>
    /<thinking>[\s\S]*?<\/thinking>/gi,     // <thinking>...</thinking>
    /\[thinking\][\s\S]*?\[\/thinking\]/gi, // [thinking]...[/thinking]
    /\*thinking\*[\s\S]*?\*\/thinking\*/gi, // *thinking*...*/thinking*
    /\(thinking\)[\s\S]*?\(\/thinking\)/gi, // (thinking)...(/thinking)
    /<!-- thinking[\s\S]*?thinking -->/gi,  // <!-- thinking...thinking -->
    /<reasoning>[\s\S]*?<\/reasoning>/gi,   // <reasoning>...</reasoning>
    /\[reasoning\][\s\S]*?\[\/reasoning\]/gi // [reasoning]...[/reasoning]
  ];
  
  let cleanedResponse = response;
  
  // Remove all thinking patterns
  for (const pattern of thinkingPatterns) {
    cleanedResponse = cleanedResponse.replace(pattern, '');
  }
  
  // Clean up extra whitespace and line breaks
  cleanedResponse = cleanedResponse
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // Multiple line breaks to double
    .replace(/^\s+|\s+$/g, '')          // Trim whitespace
    .replace(/\n\s+/g, '\n')            // Remove indented empty lines
    .replace(/\t+/g, ' ')               // Convert tabs to spaces
    .replace(/  +/g, ' ');              // Multiple spaces to single
  
  // If response is empty after cleaning, return original
  if (!cleanedResponse.trim()) {
    logger.warn('Response was empty after cleaning thinking process, returning original', {
      originalLength: response.length,
      hadThinkingContent: response !== cleanedResponse
    });
    return response;
  }
  
  // Log if we cleaned something
  if (cleanedResponse !== response) {
    logger.info('Cleaned AI response', {
      originalLength: response.length,
      cleanedLength: cleanedResponse.length,
      hadThinkingProcess: true,
      reductionPercentage: Math.round(((response.length - cleanedResponse.length) / response.length) * 100)
    });
  }
  
  return cleanedResponse;
};

/**
 * Detect if response contains thinking process artifacts
 * @param {string} response - Response to check
 * @returns {boolean} True if thinking artifacts detected
 */
export const hasThinkingArtifacts = (response) => {
  if (!response || typeof response !== 'string') {
    return false;
  }
  
  const thinkingIndicators = [
    /<think>/i,
    /<thinking>/i,
    /\[thinking\]/i,
    /\*thinking\*/i,
    /\(thinking\)/i,
    /<!-- thinking/i,
    /<reasoning>/i,
    /\[reasoning\]/i,
    /let me think/i,
    /thinking about/i,
    /my thought process/i
  ];
  
  return thinkingIndicators.some(pattern => pattern.test(response));
};