/**
 * Media Handler - Media Suggestion Extraction and Gallery Selection
 * 
 * This module handles media-related functionality including extracting
 * media suggestions from AI responses and selecting appropriate media
 * from character galleries.
 */

import logger from '../../utils/logger.js';

/**
 * Extract media suggestion from AI response text
 * @param {string} text - AI response text that may contain media suggestions
 * @returns {Object} Media suggestion object
 */
export const extractMediaSuggestion = (text) => {
  if (!text || typeof text !== 'string') {
    return getDefaultMediaSuggestion(text);
  }
  
  try {
    // Look for explicit media suggestions in various formats
    const mediaRegex = /\[IMAGE:\s*(.*?)\]|\[GIF:\s*(.*?)\]|\[MEDIA:\s*(.*?)\]/gi;
    const match = mediaRegex.exec(text);
    
    if (match) {
      const suggestion = {
        type: match[0].includes('GIF') ? 'gif' : 'image',
        description: (match[1] || match[2] || match[3] || '').trim(),
        caption: text.replace(mediaRegex, '').trim(),
        explicit: true,
        confidence: 0.9
      };
      
      logger.debug('Explicit media suggestion found', {
        type: suggestion.type,
        description: suggestion.description,
        originalLength: text.length,
        captionLength: suggestion.caption.length
      });
      
      return suggestion;
    }
    
    // Look for implicit media suggestions
    const implicitSuggestion = detectImplicitMediaSuggestion(text);
    if (implicitSuggestion) {
      return implicitSuggestion;
    }
    
    // Analyze sentiment and context for appropriate media
    const sentimentBasedSuggestion = getSentimentBasedMediaSuggestion(text);
    return sentimentBasedSuggestion;
    
  } catch (error) {
    logger.error('Error extracting media suggestion:', error);
    return getDefaultMediaSuggestion(text);
  }
};

/**
 * Detect implicit media suggestions from response content
 * @param {string} text - Response text to analyze
 * @returns {Object|null} Media suggestion or null if none detected
 */
const detectImplicitMediaSuggestion = (text) => {
  const lowerText = text.toLowerCase();
  
  // Emotion-based suggestions
  const emotionPatterns = [
    { pattern: /\b(happy|joy|excited|thrilled|delighted)\b/i, type: 'image', description: 'happy emotion', confidence: 0.7 },
    { pattern: /\b(sad|crying|tears|heartbroken)\b/i, type: 'image', description: 'sad emotion', confidence: 0.7 },
    { pattern: /\b(angry|mad|furious|frustrated)\b/i, type: 'image', description: 'angry emotion', confidence: 0.6 },
    { pattern: /\b(surprised|shocked|amazed|wow)\b/i, type: 'gif', description: 'surprised reaction', confidence: 0.8 },
    { pattern: /\b(laugh|laughing|funny|hilarious)\b/i, type: 'gif', description: 'laughing', confidence: 0.8 },
    { pattern: /\b(love|heart|romantic|affection)\b/i, type: 'image', description: 'love emotion', confidence: 0.7 }
  ];
  
  for (const emotionPattern of emotionPatterns) {
    if (emotionPattern.pattern.test(text)) {
      return {
        type: emotionPattern.type,
        description: emotionPattern.description,
        caption: text,
        explicit: false,
        confidence: emotionPattern.confidence,
        source: 'emotion_detection'
      };
    }
  }
  
  // Activity-based suggestions
  const activityPatterns = [
    { pattern: /\b(dancing|dance|party)\b/i, type: 'gif', description: 'dancing', confidence: 0.8 },
    { pattern: /\b(cooking|kitchen|recipe)\b/i, type: 'image', description: 'cooking', confidence: 0.6 },
    { pattern: /\b(travel|vacation|beach|mountain)\b/i, type: 'image', description: 'travel', confidence: 0.7 },
    { pattern: /\b(music|singing|concert)\b/i, type: 'gif', description: 'music', confidence: 0.7 },
    { pattern: /\b(reading|book|library)\b/i, type: 'image', description: 'reading', confidence: 0.6 },
    { pattern: /\b(exercise|workout|gym|running)\b/i, type: 'gif', description: 'exercise', confidence: 0.7 }
  ];
  
  for (const activityPattern of activityPatterns) {
    if (activityPattern.pattern.test(text)) {
      return {
        type: activityPattern.type,
        description: activityPattern.description,
        caption: text,
        explicit: false,
        confidence: activityPattern.confidence,
        source: 'activity_detection'
      };
    }
  }
  
  return null;
};

/**
 * Get media suggestion based on sentiment analysis
 * @param {string} text - Text to analyze for sentiment
 * @returns {Object} Sentiment-based media suggestion
 */
const getSentimentBasedMediaSuggestion = (text) => {
  const sentiment = analyzeSentiment(text);
  
  const suggestions = {
    positive: {
      type: 'image',
      description: 'positive mood',
      confidence: 0.5,
      tags: ['happy', 'smile', 'positive', 'cheerful']
    },
    negative: {
      type: 'image',
      description: 'thoughtful mood',
      confidence: 0.4,
      tags: ['thoughtful', 'contemplative', 'serious']
    },
    neutral: {
      type: 'image',
      description: 'casual mood',
      confidence: 0.3,
      tags: ['casual', 'neutral', 'everyday']
    }
  };
  
  const baseSuggestion = suggestions[sentiment] || suggestions.neutral;
  
  return {
    ...baseSuggestion,
    caption: text,
    explicit: false,
    source: 'sentiment_analysis',
    sentiment
  };
};

/**
 * Simple sentiment analysis
 * @param {string} text - Text to analyze
 * @returns {string} Sentiment category ('positive', 'negative', 'neutral')
 */
const analyzeSentiment = (text) => {
  const positiveWords = [
    'happy', 'joy', 'love', 'great', 'awesome', 'amazing', 'wonderful', 
    'fantastic', 'excellent', 'good', 'nice', 'beautiful', 'perfect', 
    'excited', 'thrilled', 'delighted', 'pleased', 'cheerful', 'glad'
  ];
  
  const negativeWords = [
    'sad', 'angry', 'hate', 'terrible', 'awful', 'bad', 'horrible', 
    'disgusting', 'annoying', 'frustrated', 'disappointed', 'upset', 
    'worried', 'concerned', 'troubled', 'stressed', 'anxious'
  ];
  
  const lowerText = text.toLowerCase();
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = (lowerText.match(regex) || []).length;
    positiveScore += matches;
  });
  
  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = (lowerText.match(regex) || []).length;
    negativeScore += matches;
  });
  
  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
};

/**
 * Select appropriate media from character gallery
 * @param {Object} character - Character data with gallery
 * @param {Object} suggestion - Media suggestion object
 * @returns {Object|null} Selected media item or null if none found
 */
export const selectMediaFromGallery = async (character, suggestion) => {
  if (!character?.gallery || !Array.isArray(character.gallery) || character.gallery.length === 0) {
    logger.debug('Character has no gallery or empty gallery', {
      characterId: character?.id,
      gallerySize: character?.gallery?.length || 0
    });
    return null;
  }
  
  try {
    let candidates = [...character.gallery];
    
    // Filter by media type preference
    if (suggestion.type) {
      const typeFiltered = candidates.filter(item => 
        item.type === suggestion.type || 
        (suggestion.type === 'gif' && item.type === 'video')
      );
      
      if (typeFiltered.length > 0) {
        candidates = typeFiltered;
      }
    }
    
    // Filter by tags if suggestion has description
    if (suggestion.description && candidates.length > 1) {
      const tagFiltered = filterByTags(candidates, suggestion);
      if (tagFiltered.length > 0) {
        candidates = tagFiltered;
      }
    }
    
    // Filter by mood/emotion if available
    if (suggestion.sentiment && candidates.length > 1) {
      const moodFiltered = filterByMood(candidates, suggestion.sentiment);
      if (moodFiltered.length > 0) {
        candidates = moodFiltered;
      }
    }
    
    // Select based on confidence and randomization
    const selected = selectBestCandidate(candidates, suggestion);
    
    if (selected) {
      logger.info('Media selected from gallery', {
        characterId: character.id,
        mediaId: selected.id,
        mediaType: selected.type,
        suggestionType: suggestion.type,
        candidatesConsidered: candidates.length,
        totalGallerySize: character.gallery.length
      });
      
      return {
        id: selected.id,
        url: selected.url,
        type: selected.type,
        caption: suggestion.caption || selected.caption || '',
        tags: selected.tags || [],
        metadata: {
          selectionMethod: 'gallery_match',
          suggestionConfidence: suggestion.confidence,
          originalSuggestion: suggestion
        }
      };
    }
    
    return null;
    
  } catch (error) {
    logger.error('Error selecting media from gallery:', {
      error: error.message,
      characterId: character?.id,
      suggestionType: suggestion?.type
    });
    return null;
  }
};

/**
 * Filter gallery items by tags matching suggestion
 * @param {Array} candidates - Gallery items to filter
 * @param {Object} suggestion - Media suggestion with description
 * @returns {Array} Filtered candidates
 */
const filterByTags = (candidates, suggestion) => {
  if (!suggestion.description) return candidates;
  
  const searchTerms = suggestion.description.toLowerCase().split(/\s+/);
  
  return candidates.filter(item => {
    if (!item.tags || !Array.isArray(item.tags)) return false;
    
    const itemTags = item.tags.map(tag => tag.toLowerCase());
    
    // Check if any search term matches any tag
    return searchTerms.some(term => 
      itemTags.some(tag => 
        tag.includes(term) || term.includes(tag)
      )
    );
  });
};

/**
 * Filter gallery items by mood/sentiment
 * @param {Array} candidates - Gallery items to filter
 * @param {string} sentiment - Sentiment category
 * @returns {Array} Filtered candidates
 */
const filterByMood = (candidates, sentiment) => {
  const moodTags = {
    positive: ['happy', 'smile', 'joy', 'cheerful', 'excited', 'positive', 'upbeat'],
    negative: ['sad', 'serious', 'thoughtful', 'contemplative', 'moody'],
    neutral: ['casual', 'neutral', 'everyday', 'normal', 'relaxed']
  };
  
  const relevantTags = moodTags[sentiment] || [];
  
  return candidates.filter(item => {
    if (!item.tags || !Array.isArray(item.tags)) return false;
    
    const itemTags = item.tags.map(tag => tag.toLowerCase());
    
    return relevantTags.some(moodTag => 
      itemTags.some(tag => tag.includes(moodTag))
    );
  });
};

/**
 * Select the best candidate from filtered options
 * @param {Array} candidates - Filtered gallery items
 * @param {Object} suggestion - Media suggestion
 * @returns {Object|null} Best candidate or null
 */
const selectBestCandidate = (candidates, suggestion) => {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  
  // Weight selection based on suggestion confidence
  const confidentSelection = suggestion.confidence > 0.7;
  
  if (confidentSelection) {
    // For high-confidence suggestions, prefer exact matches
    const exactMatches = candidates.filter(item => {
      if (!item.tags) return false;
      
      const itemTags = item.tags.map(tag => tag.toLowerCase());
      const description = suggestion.description?.toLowerCase() || '';
      
      return itemTags.some(tag => description.includes(tag));
    });
    
    if (exactMatches.length > 0) {
      return exactMatches[Math.floor(Math.random() * exactMatches.length)];
    }
  }
  
  // Default random selection from candidates
  return candidates[Math.floor(Math.random() * candidates.length)];
};

/**
 * Get default media suggestion when extraction fails
 * @param {string} text - Original text for context
 * @returns {Object} Default media suggestion
 */
const getDefaultMediaSuggestion = (text) => {
  return {
    type: 'image',
    description: 'mood',
    caption: text || '',
    explicit: false,
    confidence: 0.2,
    source: 'default_fallback'
  };
};

/**
 * Validate media item structure
 * @param {Object} mediaItem - Media item to validate
 * @returns {Object} Validation result
 */
export const validateMediaItem = (mediaItem) => {
  const validation = {
    isValid: true,
    issues: [],
    warnings: []
  };
  
  if (!mediaItem || typeof mediaItem !== 'object') {
    validation.isValid = false;
    validation.issues.push('Media item is not a valid object');
    return validation;
  }
  
  // Required fields
  const requiredFields = ['id', 'url', 'type'];
  for (const field of requiredFields) {
    if (!mediaItem[field]) {
      validation.isValid = false;
      validation.issues.push(`Missing required field: ${field}`);
    }
  }
  
  // Valid types
  const validTypes = ['image', 'gif', 'video'];
  if (mediaItem.type && !validTypes.includes(mediaItem.type)) {
    validation.warnings.push(`Unusual media type: ${mediaItem.type}`);
  }
  
  // URL validation
  if (mediaItem.url && typeof mediaItem.url === 'string') {
    try {
      new URL(mediaItem.url);
    } catch {
      validation.warnings.push('Invalid URL format');
    }
  }
  
  return validation;
};