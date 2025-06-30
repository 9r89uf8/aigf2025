/**
 * Together.ai Configuration
 * Fallback AI provider when DeepSeek is unavailable
 */
import Together from 'together-ai';
import logger from '../utils/logger.js';

/**
 * Together.ai client instance
 */
let togetherClient = null;

/**
 * Fallback models to try in sequence when DeepSeek fails
 * Ordered by preference/reliability
 */
export const TOGETHER_FALLBACK_MODELS = [
  'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
  'deepseek-ai/DeepSeek-V3',
  'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo'
];

/**
 * Default settings for Together.ai API calls
 */
export const TOGETHER_DEFAULT_SETTINGS = {
  max_tokens: 1000,
  temperature: 1.3,
  top_p: 0.7,
  top_k: 50,
  repetition_penalty: 1,
  stop: ["<｜end▁of▁sentence｜>"],
  stream: false
};

/**
 * Initialize Together.ai client
 * @returns {Together|null} Together.ai client instance or null if not configured
 */
export const initializeTogetherClient = () => {
  try {
    const apiKey = process.env.TOGETHER_API_KEY;
    
    if (!apiKey) {
      logger.warn('TOGETHER_API_KEY not provided - AI fallback unavailable');
      return null;
    }
    
    togetherClient = new Together({
      apiKey: apiKey
    });
    
    logger.info('Together.ai client initialized successfully');
    return togetherClient;
    
  } catch (error) {
    logger.error('Failed to initialize Together.ai client:', error);
    return null;
  }
};

/**
 * Get Together.ai client instance
 * @returns {Together|null} Initialized client or null
 */
export const getTogetherClient = () => {
  if (!togetherClient) {
    return initializeTogetherClient();
  }
  return togetherClient;
};

/**
 * Check if Together.ai is available as fallback
 * @returns {boolean} True if Together.ai can be used
 */
export const isTogetherAvailable = () => {
  return !!(process.env.TOGETHER_API_KEY && getTogetherClient());
};

/**
 * Generate response using Together.ai with model fallback
 * @param {Array} messages - Chat messages array
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated response content
 */
export const generateTogetherResponse = async (messages, options = {}) => {
  const client = getTogetherClient();
  
  if (!client) {
    throw new Error('Together.ai client not available');
  }
  
  // Merge default settings with provided options
  const settings = {
    ...TOGETHER_DEFAULT_SETTINGS,
    ...options
  };
  
  let lastError = null;
  
  // Try each model in sequence until one works
  for (const model of TOGETHER_FALLBACK_MODELS) {
    try {
      logger.info(`Attempting Together.ai generation with model: ${model}`);
      
      const response = await client.chat.completions.create({
        messages: messages,
        model: model,
        ...settings
      });
      
      const content = response.choices[0].message.content;
      
      if (!content || content.trim().length === 0) {
        throw new Error('Empty response from Together.ai');
      }
      
      logger.info(`Successfully generated response with Together.ai model: ${model}`, {
        responseLength: content.length,
        usage: response.usage
      });
      
      return {
        content: content,
        model: model,
        usage: response.usage,
        provider: 'together'
      };
      
    } catch (error) {
      logger.warn(`Together.ai model ${model} failed:`, {
        error: error.message,
        model: model
      });
      lastError = error;
      // Continue to next model
    }
  }
  
  // All models failed
  logger.error('All Together.ai models failed', {
    modelsAttempted: TOGETHER_FALLBACK_MODELS,
    lastError: lastError.message
  });
  
  throw new Error(`All Together.ai fallback models failed. Last error: ${lastError.message}`);
};

/**
 * Test Together.ai connection
 * @returns {Promise<boolean>} True if connection successful
 */
export const testTogetherConnection = async () => {
  try {
    const client = getTogetherClient();
    if (!client) return false;
    
    // Simple test message
    const testMessages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say "Hello" in response.' }
    ];
    
    const response = await generateTogetherResponse(testMessages, {
      max_tokens: 10
    });
    
    return !!(response && response.content);
    
  } catch (error) {
    logger.error('Together.ai connection test failed:', error);
    return false;
  }
};

export default {
  initializeTogetherClient,
  getTogetherClient,
  isTogetherAvailable,
  generateTogetherResponse,
  testTogetherConnection,
  TOGETHER_FALLBACK_MODELS,
  TOGETHER_DEFAULT_SETTINGS
};