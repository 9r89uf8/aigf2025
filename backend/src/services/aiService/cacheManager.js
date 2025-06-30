/**
 * Cache Manager - Response Pattern Caching for Consistency
 * 
 * This module handles caching of response patterns to maintain
 * character consistency and improve response quality over time.
 */

import { getRedisClient } from '../../config/redis.js';
import logger from '../../utils/logger.js';

/**
 * Cache response pattern for character consistency
 * @param {string} characterId - Character ID
 * @param {string} userMessage - User's input message
 * @param {string} aiResponse - AI's response
 * @param {Object} metadata - Additional metadata to cache
 * @returns {Promise<boolean>} Success status
 */
export const cacheResponsePattern = async (characterId, userMessage, aiResponse, metadata = {}) => {
  if (!characterId || !userMessage || !aiResponse) {
    logger.warn('Invalid parameters for response pattern caching', {
      hasCharacterId: !!characterId,
      hasUserMessage: !!userMessage,
      hasAiResponse: !!aiResponse
    });
    return false;
  }
  
  try {
    const redis = getRedisClient();
    if (!redis) {
      logger.warn('Redis client not available for response caching');
      return false;
    }
    
    const pattern = {
      input: userMessage.toLowerCase().slice(0, 100), // Truncate for storage efficiency
      response: aiResponse.slice(0, 200),
      timestamp: Date.now(),
      inputLength: userMessage.length,
      responseLength: aiResponse.length,
      metadata: {
        ...metadata,
        cached: true
      }
    };
    
    const key = `response_pattern:${characterId}`;
    
    // Store pattern in Redis list (FIFO with size limit)
    await redis.lpush(key, JSON.stringify(pattern));
    await redis.ltrim(key, 0, 19); // Keep last 20 patterns
    await redis.expire(key, 86400 * 7); // 7 days expiration
    
    logger.debug('Response pattern cached', {
      characterId,
      inputPreview: userMessage.substring(0, 50),
      responsePreview: aiResponse.substring(0, 50),
      patternCount: await redis.llen(key)
    });
    
    return true;
    
  } catch (error) {
    logger.error('Failed to cache response pattern:', {
      error: error.message,
      characterId,
      userMessageLength: userMessage?.length,
      aiResponseLength: aiResponse?.length
    });
    return false;
  }
};

/**
 * Get cached response patterns for a character
 * @param {string} characterId - Character ID
 * @param {number} limit - Maximum number of patterns to retrieve
 * @returns {Promise<Array>} Array of cached patterns
 */
export const getCachedPatterns = async (characterId, limit = 10) => {
  if (!characterId) {
    return [];
  }
  
  try {
    const redis = getRedisClient();
    if (!redis) {
      return [];
    }
    
    const key = `response_pattern:${characterId}`;
    const patterns = await redis.lrange(key, 0, limit - 1);
    
    const parsedPatterns = patterns.map(pattern => {
      try {
        return JSON.parse(pattern);
      } catch (parseError) {
        logger.warn('Failed to parse cached pattern', { parseError: parseError.message });
        return null;
      }
    }).filter(Boolean);
    
    logger.debug('Retrieved cached patterns', {
      characterId,
      patternCount: parsedPatterns.length,
      requestedLimit: limit
    });
    
    return parsedPatterns;
    
  } catch (error) {
    logger.error('Failed to retrieve cached patterns:', {
      error: error.message,
      characterId
    });
    return [];
  }
};

/**
 * Find similar cached responses for consistency
 * @param {string} characterId - Character ID
 * @param {string} userMessage - User's current message
 * @param {number} similarityThreshold - Minimum similarity score (0-1)
 * @returns {Promise<Array>} Array of similar cached patterns
 */
export const findSimilarResponses = async (characterId, userMessage, similarityThreshold = 0.6) => {
  if (!characterId || !userMessage) {
    return [];
  }
  
  try {
    const cachedPatterns = await getCachedPatterns(characterId, 20);
    
    if (cachedPatterns.length === 0) {
      return [];
    }
    
    const currentMessageLower = userMessage.toLowerCase();
    const similarPatterns = [];
    
    for (const pattern of cachedPatterns) {
      const similarity = calculateTextSimilarity(currentMessageLower, pattern.input);
      
      if (similarity >= similarityThreshold) {
        similarPatterns.push({
          ...pattern,
          similarity,
          age: Date.now() - pattern.timestamp
        });
      }
    }
    
    // Sort by similarity (descending) and age (ascending - prefer recent)
    similarPatterns.sort((a, b) => {
      const similarityDiff = b.similarity - a.similarity;
      if (Math.abs(similarityDiff) < 0.1) {
        return a.age - b.age; // If similarity is close, prefer newer
      }
      return similarityDiff;
    });
    
    logger.debug('Found similar cached responses', {
      characterId,
      totalPatterns: cachedPatterns.length,
      similarPatterns: similarPatterns.length,
      threshold: similarityThreshold
    });
    
    return similarPatterns.slice(0, 5); // Return top 5 matches
    
  } catch (error) {
    logger.error('Failed to find similar responses:', {
      error: error.message,
      characterId,
      userMessageLength: userMessage?.length
    });
    return [];
  }
};

/**
 * Calculate text similarity using simple word overlap
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} Similarity score (0-1)
 */
const calculateTextSimilarity = (text1, text2) => {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(word => word.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(word => word.length > 2));
  
  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
};

/**
 * Cache character conversation summary
 * @param {string} characterId - Character ID
 * @param {string} userId - User ID
 * @param {Object} summary - Conversation summary data
 * @returns {Promise<boolean>} Success status
 */
export const cacheConversationSummary = async (characterId, userId, summary) => {
  if (!characterId || !userId || !summary) {
    return false;
  }
  
  try {
    const redis = getRedisClient();
    if (!redis) {
      return false;
    }
    
    const key = `conversation_summary:${characterId}:${userId}`;
    const summaryData = {
      ...summary,
      timestamp: Date.now(),
      cached: true
    };
    
    await redis.setex(key, 86400 * 3, JSON.stringify(summaryData)); // 3 days expiration
    
    logger.debug('Conversation summary cached', {
      characterId,
      userId,
      summaryKeys: Object.keys(summary)
    });
    
    return true;
    
  } catch (error) {
    logger.error('Failed to cache conversation summary:', {
      error: error.message,
      characterId,
      userId
    });
    return false;
  }
};

/**
 * Get cached conversation summary
 * @param {string} characterId - Character ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Cached summary or null
 */
export const getCachedConversationSummary = async (characterId, userId) => {
  if (!characterId || !userId) {
    return null;
  }
  
  try {
    const redis = getRedisClient();
    if (!redis) {
      return null;
    }
    
    const key = `conversation_summary:${characterId}:${userId}`;
    const cachedData = await redis.get(key);
    
    if (!cachedData) {
      return null;
    }
    
    const summary = JSON.parse(cachedData);
    
    logger.debug('Retrieved conversation summary', {
      characterId,
      userId,
      age: Date.now() - summary.timestamp
    });
    
    return summary;
    
  } catch (error) {
    logger.error('Failed to retrieve conversation summary:', {
      error: error.message,
      characterId,
      userId
    });
    return null;
  }
};

/**
 * Cache AI model performance metrics
 * @param {string} model - Model identifier
 * @param {Object} metrics - Performance metrics
 * @returns {Promise<boolean>} Success status
 */
export const cacheModelMetrics = async (model, metrics) => {
  if (!model || !metrics) {
    return false;
  }
  
  try {
    const redis = getRedisClient();
    if (!redis) {
      return false;
    }
    
    const key = `model_metrics:${model}`;
    const metricsData = {
      ...metrics,
      timestamp: Date.now()
    };
    
    // Store as hash for easy updates
    await redis.hset(key, 'data', JSON.stringify(metricsData));
    await redis.expire(key, 86400); // 24 hours expiration
    
    logger.debug('Model metrics cached', {
      model,
      metricsKeys: Object.keys(metrics)
    });
    
    return true;
    
  } catch (error) {
    logger.error('Failed to cache model metrics:', {
      error: error.message,
      model
    });
    return false;
  }
};

/**
 * Get cache statistics for monitoring
 * @param {string} characterId - Optional character ID for specific stats
 * @returns {Promise<Object>} Cache statistics
 */
export const getCacheStats = async (characterId = null) => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return { error: 'Redis not available' };
    }
    
    const stats = {
      timestamp: Date.now(),
      redis: {
        connected: redis.status === 'ready'
      }
    };
    
    if (characterId) {
      // Character-specific stats
      const patternKey = `response_pattern:${characterId}`;
      const patternCount = await redis.llen(patternKey).catch(() => 0);
      
      stats.character = {
        id: characterId,
        cachedPatterns: patternCount
      };
    } else {
      // Global stats
      const keys = await redis.keys('response_pattern:*').catch(() => []);
      stats.global = {
        totalCharactersWithCache: keys.length,
        cacheKeys: keys.length
      };
    }
    
    return stats;
    
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
    return { error: error.message };
  }
};

/**
 * Clear cache for a specific character
 * @param {string} characterId - Character ID
 * @returns {Promise<boolean>} Success status
 */
export const clearCharacterCache = async (characterId) => {
  if (!characterId) {
    return false;
  }
  
  try {
    const redis = getRedisClient();
    if (!redis) {
      return false;
    }
    
    const patterns = [`response_pattern:${characterId}`, `conversation_summary:${characterId}:*`];
    
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
    
    logger.info('Character cache cleared', {
      characterId,
      patternsCleared: patterns.length
    });
    
    return true;
    
  } catch (error) {
    logger.error('Failed to clear character cache:', {
      error: error.message,
      characterId
    });
    return false;
  }
};