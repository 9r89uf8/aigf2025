/**
 * Personality Engine - Character Personality Application and Tone Adjustment
 * 
 * This module applies character personality traits to AI responses,
 * coordinating various personality modification functions to create
 * character-specific communication styles.
 */

import { 
  addFlirtyTone, 
  addHumor, 
  addIntellectualDepth, 
  adjustFormality, 
  addEmojis,
  addPlayfulElements,
  addMysteriousElements,
  addCompassionateElements 
} from './responsePersonalizer.js';
import cache from '../cacheService.js';
import crypto from 'crypto';
import logger from '../../utils/logger.js';

/**
 * Apply character personality traits to response with caching
 * @param {string} response - Clean response text
 * @param {Object} character - Character data with personality settings
 * @returns {Promise<string>} Personalized response
 */
export const applyPersonality = async (response, character) => {
  if (!response || typeof response !== 'string') {
    logger.warn('Invalid response passed to personality engine', {
      responseType: typeof response,
      characterId: character?.id
    });
    return response;
  }
  
  if (!character || !character.personality) {
    logger.debug('No personality data available, returning original response', {
      characterId: character?.id
    });
    return response;
  }
  
  try {
    // Create a hash of the response content for caching
    const responseHash = crypto.createHash('md5').update(response).digest('hex').substring(0, 8);
    const cacheKey = cache.keys.personalityResult(character.id, responseHash);
    
    // Try to get cached personality result
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      logger.debug('Personality cache hit', {
        characterId: character.id,
        responseHash,
        originalLength: response.length,
        cachedLength: cachedResult.length
      });
      return cachedResult;
    }
    
    // Apply personality processing
    const personalizedResponse = applyPersonalityInternal(response, character);
    
    // Cache the result for 1 hour - personality patterns are consistent
    await cache.set(cacheKey, personalizedResponse, 3600);
    
    logger.debug('Personality applied and cached', {
      characterId: character.id,
      responseHash,
      originalLength: response.length,
      finalLength: personalizedResponse.length
    });
    
    return personalizedResponse;
    
  } catch (error) {
    logger.error('Error applying personality:', {
      error: error.message,
      characterId: character?.id,
      responseLength: response?.length
    });
    
    // Return original response if personality application fails
    return response;
  }
};

/**
 * Internal personality application logic (separated for caching)
 * @param {string} response - Clean response text
 * @param {Object} character - Character data with personality settings
 * @returns {string} Personalized response
 */
const applyPersonalityInternal = (response, character) => {
  let personalizedResponse = response;
  const personality = character.personality;
  const traits = personality.traits || [];
  
  logger.debug('Applying personality traits', {
    characterId: character.id,
    traits: traits,
    formality: personality.formality,
    humor: personality.humor,
    originalLength: response.length
  });
  
  // Apply trait-based modifications
  personalizedResponse = applyTraitModifications(personalizedResponse, traits, personality);
  
  // Apply formality level adjustments
  if (personality.formality) {
    personalizedResponse = adjustFormality(personalizedResponse, personality.formality);
  }
  
  // Apply emoji additions based on personality
  if (shouldAddEmojis(personality, traits)) {
    personalizedResponse = addEmojis(personalizedResponse, personality);
  }
  
  // Apply final personality polish
  personalizedResponse = applyPersonalityPolish(personalizedResponse, character);
  
  logger.debug('Personality application complete', {
    characterId: character.id,
    originalLength: response.length,
    finalLength: personalizedResponse.length,
    traitsApplied: traits.length
  });
  
  return personalizedResponse;
};

/**
 * Apply trait-based modifications to response
 * @param {string} response - Response text
 * @param {Array} traits - Character traits
 * @param {Object} personality - Full personality object
 * @returns {string} Modified response
 */
const applyTraitModifications = (response, traits, personality) => {
  let modifiedResponse = response;
  
  // Apply each trait modification
  for (const trait of traits) {
    switch (trait.toLowerCase()) {
      case 'flirty':
      case 'flirtatious':
        modifiedResponse = addFlirtyTone(modifiedResponse, personality);
        break;
        
      case 'funny':
      case 'humorous':
      case 'witty':
        modifiedResponse = addHumor(modifiedResponse, personality);
        break;
        
      case 'intellectual':
      case 'smart':
      case 'thoughtful':
        modifiedResponse = addIntellectualDepth(modifiedResponse, personality);
        break;
        
      case 'playful':
      case 'mischievous':
        modifiedResponse = addPlayfulElements(modifiedResponse, personality);
        break;
        
      case 'mysterious':
      case 'enigmatic':
        modifiedResponse = addMysteriousElements(modifiedResponse, personality);
        break;
        
      case 'compassionate':
      case 'caring':
      case 'empathetic':
        modifiedResponse = addCompassionateElements(modifiedResponse, personality);
        break;
        
      default:
        logger.debug('Unknown personality trait, skipping', { trait });
    }
  }
  
  return modifiedResponse;
};

/**
 * Determine if emojis should be added based on personality
 * @param {Object} personality - Personality settings
 * @param {Array} traits - Character traits
 * @returns {boolean} Whether to add emojis
 */
const shouldAddEmojis = (personality, traits) => {
  // High humor characters get emojis
  if (personality.humor && personality.humor > 0.5) {
    return true;
  }
  
  // Certain traits favor emojis
  const emojiTraits = ['playful', 'funny', 'flirty', 'compassionate', 'mischievous'];
  if (traits.some(trait => emojiTraits.includes(trait.toLowerCase()))) {
    return true;
  }
  
  // Very formal characters avoid emojis
  if (personality.formality === 'very_formal' || personality.formality === 'formal') {
    return false;
  }
  
  // Default based on overall personality
  return personality.expressiveness > 0.6 || false;
};

/**
 * Apply final personality polish and consistency checks
 * @param {string} response - Response after trait modifications
 * @param {Object} character - Character data
 * @returns {string} Polished response
 */
const applyPersonalityPolish = (response, character) => {
  let polished = response;
  
  // Apply character-specific speech patterns
  if (character.personality?.speechPatterns) {
    polished = applySpeechPatterns(polished, character.personality.speechPatterns);
  }
  
  // Apply character voice consistency
  polished = applyVoiceConsistency(polished, character);
  
  // Ensure personality intensity is appropriate
  polished = balancePersonalityIntensity(polished, character.personality);
  
  return polished;
};

/**
 * Apply character-specific speech patterns
 * @param {string} response - Response text
 * @param {Object} speechPatterns - Speech pattern settings
 * @returns {string} Response with speech patterns applied
 */
const applySpeechPatterns = (response, speechPatterns) => {
  let modified = response;
  
  // Common speech pattern applications
  if (speechPatterns.contractionsFrequency === 'high') {
    modified = modified.replace(/\bdo not\b/gi, "don't");
    modified = modified.replace(/\bwill not\b/gi, "won't");
    modified = modified.replace(/\bcannot\b/gi, "can't");
    modified = modified.replace(/\byou are\b/gi, "you're");
    modified = modified.replace(/\bi am\b/gi, "I'm");
  } else if (speechPatterns.contractionsFrequency === 'low') {
    modified = modified.replace(/\bdon't\b/gi, "do not");
    modified = modified.replace(/\bwon't\b/gi, "will not");
    modified = modified.replace(/\bcan't\b/gi, "cannot");
    modified = modified.replace(/\byou're\b/gi, "you are");
    modified = modified.replace(/\bI'm\b/gi, "I am");
  }
  
  // Filler words based on character
  if (speechPatterns.fillerWords && Math.random() < 0.2) {
    const fillers = speechPatterns.fillerWords;
    const randomFiller = fillers[Math.floor(Math.random() * fillers.length)];
    
    // Insert filler at random appropriate positions
    const sentences = modified.split(/([.!?])/);
    if (sentences.length > 2) {
      const insertIndex = Math.floor(Math.random() * (sentences.length - 1));
      sentences[insertIndex] = sentences[insertIndex] + ` ${randomFiller},`;
      modified = sentences.join('');
    }
  }
  
  return modified;
};

/**
 * Apply voice consistency based on character history
 * @param {string} response - Response text
 * @param {Object} character - Character data
 * @returns {string} Response with voice consistency applied
 */
const applyVoiceConsistency = (response, character) => {
  // This would ideally check against character's previous responses
  // For now, apply basic consistency rules
  
  let consistent = response;
  
  // Ensure consistent punctuation style
  if (character.personality?.punctuationStyle === 'minimal') {
    consistent = consistent.replace(/!+/g, '.');
    consistent = consistent.replace(/\?{2,}/g, '?');
  } else if (character.personality?.punctuationStyle === 'expressive') {
    // Allow expressive punctuation
    consistent = consistent.replace(/\.{3,}/g, '...');
  }
  
  return consistent;
};

/**
 * Balance personality intensity to avoid over-application
 * @param {string} response - Response text
 * @param {Object} personality - Personality settings
 * @returns {string} Balanced response
 */
const balancePersonalityIntensity = (response, personality) => {
  let balanced = response;
  
  // Prevent emoji overload
  const emojiCount = (balanced.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
  const words = balanced.split(/\s+/).length;
  
  if (emojiCount > words * 0.2) {
    // Remove excess emojis (keep only first few)
    let emojiRemoved = 0;
    balanced = balanced.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, (match) => {
      emojiRemoved++;
      return emojiRemoved > 3 ? '' : match;
    });
  }
  
  // Prevent excessive personality markers
  const personalityMarkers = [
    /\b(actually|honestly|literally|basically)\b/gi,
    /\b(like|you know|I mean)\b/gi,
    /\b(totally|absolutely|definitely)\b/gi
  ];
  
  personalityMarkers.forEach(pattern => {
    const matches = (balanced.match(pattern) || []).length;
    if (matches > 2) {
      let replacements = 0;
      balanced = balanced.replace(pattern, (match) => {
        replacements++;
        return replacements > 2 ? '' : match;
      });
    }
  });
  
  return balanced.trim();
};

/**
 * Get personality application summary for debugging
 * @param {Object} character - Character data
 * @returns {Object} Summary of personality settings
 */
export const getPersonalitySummary = (character) => {
  if (!character?.personality) {
    return { hasPersonality: false };
  }
  
  const personality = character.personality;
  
  return {
    hasPersonality: true,
    characterId: character.id,
    traits: personality.traits || [],
    formality: personality.formality || 'casual',
    humor: personality.humor || 0,
    expressiveness: personality.expressiveness || 0,
    speechPatterns: !!personality.speechPatterns,
    customizations: Object.keys(personality).length
  };
};