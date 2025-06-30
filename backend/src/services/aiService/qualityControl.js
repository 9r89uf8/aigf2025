/**
 * Quality Control - Response Quality Assessment and Retry Logic
 * 
 * This module handles response quality assessment, retry mechanisms,
 * and smart truncation to ensure high-quality AI responses.
 */

import { getDeepSeekClient } from '../../config/deepseek.js';
import { generateTogetherResponse, isTogetherAvailable } from '../../config/together.js';
import { cleanAIResponse } from './responseCleanup.js';
import { applyPersonality } from './personalityEngine.js';
import { smartTruncate, assessResponseQuality } from './responseUtils.js';
import logger from '../../utils/logger.js';

/**
 * Brevity prompts for retry attempts
 * @private
 */
const BREVITY_PROMPTS = [
  "Respond in 1 short sentence only. Be natural and conversational.",
  "Keep response under 20 words. Be brief, human-like, and complete your thought.",
  "One quick, natural reply. Maximum 15 words. End with proper punctuation."
];

/**
 * Generate response with quality control, retries, and smart truncation
 * @param {Array} messages - Message array for AI
 * @param {Object} aiSettings - AI configuration settings
 * @param {Object} character - Character data
 * @returns {Promise<Object>} Generated response with quality control
 */
export const generateWithQualityControl = async (messages, aiSettings, character) => {
  let attempt = 0;
  const maxAttempts = 2; // 1 initial + 1 retry
  
  while (attempt < maxAttempts) {
    try {
      // Generate response (initial attempt or retry with brevity)
      let response;
      if (attempt === 0) {
        response = await generateSingleResponse(messages, aiSettings, character);
      } else {
        response = await retryWithBrevity(messages, aiSettings, character, attempt - 1);
      }
      
      // Clean response to remove thinking process
      const cleanedResponse = cleanAIResponse(response.content);
      
      // Assess response quality
      const quality = assessResponseQuality(cleanedResponse);
      
      logger.info('Response quality assessment', {
        attempt: attempt + 1,
        isComplete: quality.isComplete,
        isTooLong: quality.isTooLong,
        needsRetry: quality.needsRetry,
        reason: quality.reason,
        characterCount: quality.characterCount,
        wordCount: quality.wordCount,
        provider: response.provider
      });
      
      // If response is good quality, apply personality and return
      if (quality.isComplete && !quality.needsRetry) {
        let finalResponse = cleanedResponse;
        
        // Apply smart truncation if too long
        if (quality.isTooLong) {
          finalResponse = smartTruncate(cleanedResponse, 200);
          logger.info('Applied smart truncation', {
            originalLength: cleanedResponse.length,
            truncatedLength: finalResponse.length
          });
        }
        
        // Apply character personality to response
        const personalizedResponse = await applyPersonality(finalResponse, character);
        
        return {
          content: personalizedResponse,
          usage: response.usage,
          provider: response.provider,
          model: response.model,
          fallbackUsed: response.fallbackUsed,
          qualityControl: {
            attempts: attempt + 1,
            wasRetried: attempt > 0,
            wasTruncated: quality.isTooLong,
            finalQuality: quality
          }
        };
      }
      
      // Response needs improvement - retry if attempts remaining
      if (attempt < maxAttempts - 1) {
        logger.warn('Response quality insufficient, retrying', {
          attempt: attempt + 1,
          reason: quality.reason,
          responsePreview: cleanedResponse.substring(0, 100)
        });
        attempt++;
        continue;
      } else {
        // Max attempts reached - use smart truncation as final fallback
        logger.warn('Max retry attempts reached, applying smart truncation', {
          finalAttempt: attempt + 1,
          reason: quality.reason
        });
        
        const truncatedResponse = smartTruncate(cleanedResponse, 200);
        const personalizedResponse = await applyPersonality(truncatedResponse, character);
        
        return {
          content: personalizedResponse,
          usage: response.usage,
          provider: response.provider,
          model: response.model,
          fallbackUsed: response.fallbackUsed,
          qualityControl: {
            attempts: attempt + 1,
            wasRetried: true,
            wasTruncated: true,
            maxAttemptsReached: true,
            finalQuality: quality
          }
        };
      }
      
    } catch (error) {
      // If this is the last attempt or a critical error, handle gracefully
      if (attempt === maxAttempts - 1 || error.message.includes('not configured')) {
        logger.error('All AI generation attempts failed', {
          finalAttempt: attempt + 1,
          error: error.message
        });
        
        // Throw error metadata instead of fallback message
        const llmError = {
          error: true,
          errorType: 'llm_failure',
          isLLMError: true,
          provider: 'fallback',
          originalError: error.message,
          qualityControl: {
            attempts: attempt + 1,
            failed: true,
            error: error.message
          },
          timestamp: Date.now()
        };
        
        // Throw the error object so it can be caught properly
        throw llmError;
      }
      
      // Retry on recoverable errors
      logger.warn('Response generation failed, retrying', {
        attempt: attempt + 1,
        error: error.message
      });
      attempt++;
    }
  }
};

/**
 * Retry response generation with enhanced brevity prompts
 * @private
 */
const retryWithBrevity = async (messages, aiSettings, character, attempt = 0) => {
  if (attempt >= BREVITY_PROMPTS.length) {
    throw new Error('Maximum retry attempts reached');
  }
  
  // Enhance system prompt with brevity instruction
  const enhancedMessages = [...messages];
  const systemMessageIndex = enhancedMessages.findIndex(msg => msg.role === 'system');
  
  if (systemMessageIndex >= 0) {
    enhancedMessages[systemMessageIndex] = {
      ...enhancedMessages[systemMessageIndex],
      content: enhancedMessages[systemMessageIndex].content + 
        `\n\nCRITICAL BREVITY INSTRUCTION: ${BREVITY_PROMPTS[attempt]}`
    };
  } else {
    // Add brevity instruction as new system message
    enhancedMessages.unshift({
      role: 'system',
      content: BREVITY_PROMPTS[attempt]
    });
  }
  
  logger.info(`Retrying with brevity prompt (attempt ${attempt + 1})`, {
    brevityPrompt: BREVITY_PROMPTS[attempt],
    messageCount: enhancedMessages.length
  });
  
  return generateSingleResponse(enhancedMessages, aiSettings, character);
};

/**
 * Generate single response without quality control (used by main function and retries)
 * @private
 */
const generateSingleResponse = async (messages, aiSettings, character) => {
  // First try DeepSeek API
  try {
    const deepseek = getDeepSeekClient();
    if (!deepseek) {
      throw new Error('DeepSeek client not initialized');
    }
    
    const completion = await deepseek.chat.completions.create({
      messages: messages,
      model: 'deepseek-reasoner',
      temperature: 1.3,
      max_tokens: 500
    });
    
    const response = completion.choices[0].message.content;
    console.log(response)
    
    if (!response || response.trim().length === 0) {
      throw new Error('DeepSeek returned empty response');
    }
    
    return {
      content: response,
      usage: completion.usage,
      provider: 'deepseek',
      model: 'deepseek-reasoner'
    };
    
  } catch (deepseekError) {
    logger.warn('DeepSeek API failed:', {
      error: deepseekError.message,
      code: deepseekError.code
    });
    
    // Try Together.ai fallback
    if (!isTogetherAvailable()) {
      throw new Error('AI service unavailable: DeepSeek failed and Together.ai not configured');
    }
    
    const togetherResponse = await generateTogetherResponse(messages, {
      max_tokens: 500,
      temperature: 1.3
    });

    console.log(togetherResponse.content);
    
    return {
      content: togetherResponse.content,
      usage: togetherResponse.usage,
      provider: 'together',
      model: togetherResponse.model,
      fallbackUsed: true
    };
  }
};