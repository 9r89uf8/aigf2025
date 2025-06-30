/**
 * Content Filter - Safety Filtering and Prohibited Content Checking
 * 
 * This module handles content safety filtering using local pattern matching
 * to ensure AI responses are appropriate and safe for users.
 */

import { CONTENT_FILTER } from '../../config/deepseek.js';
import logger from '../../utils/logger.js';

/**
 * Filter content for safety and appropriateness
 * @param {string} content - Content to filter
 * @returns {Promise<Object>} Filter result with blocked status and reason
 */
export const filterContent = async (content) => {
  if (!content || typeof content !== 'string') {
    return { 
      blocked: false, 
      reason: null,
      confidence: 0 
    };
  }
  
  try {
    // Check prohibited patterns from config
    for (const pattern of CONTENT_FILTER.prohibited) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        logger.warn('Content blocked by filter', {
          pattern: pattern.source,
          matchedText: match[0].substring(0, 50),
          contentLength: content.length
        });
        
        return {
          blocked: true,
          reason: 'prohibited_content',
          match: match[0],
          confidence: 1.0
        };
      }
    }
    
    // Additional safety checks with specific categories
    const violationCheck = await checkContentViolations(content);
    if (violationCheck.blocked) {
      return violationCheck;
    }
    
    // Content passed all filters
    return { 
      blocked: false, 
      reason: null,
      confidence: 0 
    };
    
  } catch (error) {
    logger.error('Error in content filtering:', error);
    
    // Fail safe - block content if filtering fails
    return {
      blocked: true,
      reason: 'filter_error',
      error: error.message,
      confidence: 1.0
    };
  }
};

/**
 * Check for specific content violations
 * @param {string} content - Content to check
 * @returns {Promise<Object>} Detailed violation check result
 */
const checkContentViolations = async (content) => {
  const lowerContent = content.toLowerCase();
  
  // Violence and harm patterns
  const violencePatterns = [
    /\b(kill|murder|assassinate|destroy|eliminate)\s+(you|yourself|him|her|them|someone)\b/i,
    /\b(hurt|harm|damage|injure)\s+(you|yourself|physically|badly)\b/i,
    /\b(suicide|self.harm|cut yourself|end your life)\b/i,
    /\b(bomb|explosive|weapon|gun|knife)\s+(making|instructions|how to)\b/i
  ];
  
  for (const pattern of violencePatterns) {
    if (pattern.test(content)) {
      return {
        blocked: true,
        reason: 'violence',
        category: 'violence_harm',
        confidence: 0.9
      };
    }
  }
  
  // Self-harm patterns
  const selfHarmPatterns = [
    /\b(cut|cutting|self.harm|self.injury)\b/i,
    /\b(want to die|wish I was dead|kill myself)\b/i,
    /\b(suicide|suicidal thoughts|end it all)\b/i
  ];
  
  for (const pattern of selfHarmPatterns) {
    if (pattern.test(content)) {
      return {
        blocked: true,
        reason: 'selfHarm',
        category: 'self_harm',
        confidence: 0.95
      };
    }
  }
  
  // Harassment patterns
  const harassmentPatterns = [
    /\b(stupid|idiot|moron|retard|dumb)\s+(bitch|slut|whore)\b/i,
    /\b(go kill yourself|kys|neck yourself)\b/i,
    /\b(hate you|despise you|loathe you)\s+(so much|completely)\b/i
  ];
  
  for (const pattern of harassmentPatterns) {
    if (pattern.test(content)) {
      return {
        blocked: true,
        reason: 'harassment',
        category: 'harassment',
        confidence: 0.8
      };
    }
  }
  
  // Illegal activity patterns
  const illegalPatterns = [
    /\b(how to make|create|build)\s+(drugs|meth|cocaine|heroin)\b/i,
    /\b(steal|rob|burglarize|fraud)\s+(money|credit cards|identity)\b/i,
    /\b(pirate|crack|hack)\s+(software|games|accounts)\b/i,
    /\b(child|minor)\s+(exploitation|abuse|inappropriate)\b/i
  ];
  
  for (const pattern of illegalPatterns) {
    if (pattern.test(content)) {
      return {
        blocked: true,
        reason: 'illegal',
        category: 'illegal_activity',
        confidence: 0.9
      };
    }
  }
  
  // Adult content patterns (basic detection)
  const adultPatterns = [
    /\b(explicit|graphic)\s+(sexual|adult|mature)\s+(content|material)\b/i,
    /\b(sexual|intimate)\s+(roleplay|fantasy|scenario)\b/i
  ];
  
  for (const pattern of adultPatterns) {
    if (pattern.test(content)) {
      return {
        blocked: true,
        reason: 'adult_content',
        category: 'adult_content',
        confidence: 0.7
      };
    }
  }
  
  // No violations found
  return { blocked: false };
};

/**
 * Get appropriate filtered response message based on filter reason
 * @param {string} reason - Filter reason
 * @param {string} category - Specific category if available
 * @returns {string} Safe fallback message
 */
export const getFilteredResponseMessage = (reason, category = null) => {
  const messages = {
    prohibited_content: "I can't respond to that. Let's talk about something else! 😊",
    violence: "I prefer to keep our conversation peaceful. What else would you like to chat about?",
    selfHarm: "I care about your wellbeing. If you're going through a tough time, please reach out to someone who can help. 💙",
    harassment: "Let's keep our conversation respectful and positive! 🌟",
    illegal: "I can't discuss that topic. How about we talk about something else?",
    adult_content: "I'd prefer to keep our conversation friendly and appropriate. What else can we chat about?",
    filter_error: "I'm having trouble processing that message. Could you try rephrasing it? 🤔"
  };
  
  const fallbackMessage = "I can't respond to that message. Let's change the topic! 🌟";
  
  return messages[reason] || messages[category] || fallbackMessage;
};

/**
 * Check if content contains potential spam or repetitive patterns
 * @param {string} content - Content to check
 * @returns {Object} Spam detection result
 */
export const detectSpam = (content) => {
  if (!content || typeof content !== 'string') {
    return { isSpam: false };
  }
  
  const spamIndicators = {
    isSpam: false,
    reasons: [],
    confidence: 0
  };
  
  // Excessive repetition
  const words = content.toLowerCase().split(/\s+/);
  const wordCounts = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  const maxRepetition = Math.max(...Object.values(wordCounts));
  if (maxRepetition > words.length * 0.3 && words.length > 10) {
    spamIndicators.isSpam = true;
    spamIndicators.reasons.push('excessive_repetition');
    spamIndicators.confidence += 0.4;
  }
  
  // Excessive caps
  const capsCount = (content.match(/[A-Z]/g) || []).length;
  const capsRatio = capsCount / content.length;
  if (capsRatio > 0.5 && content.length > 20) {
    spamIndicators.isSpam = true;
    spamIndicators.reasons.push('excessive_caps');
    spamIndicators.confidence += 0.3;
  }
  
  // Excessive special characters
  const specialChars = (content.match(/[!@#$%^&*()_+=\[\]{}|;:,.<>?]/g) || []).length;
  const specialRatio = specialChars / content.length;
  if (specialRatio > 0.3) {
    spamIndicators.isSpam = true;
    spamIndicators.reasons.push('excessive_special_chars');
    spamIndicators.confidence += 0.2;
  }
  
  // Very long messages (potential spam)
  if (content.length > 2000) {
    spamIndicators.reasons.push('very_long_message');
    spamIndicators.confidence += 0.1;
  }
  
  spamIndicators.confidence = Math.min(spamIndicators.confidence, 1.0);
  
  return spamIndicators;
};

/**
 * Validate content length and format
 * @param {string} content - Content to validate
 * @returns {Object} Validation result
 */
export const validateContentFormat = (content) => {
  const validation = {
    isValid: true,
    issues: [],
    suggestions: []
  };
  
  if (!content || typeof content !== 'string') {
    validation.isValid = false;
    validation.issues.push('Content is not a valid string');
    return validation;
  }
  
  // Check length
  if (content.length === 0) {
    validation.isValid = false;
    validation.issues.push('Content is empty');
  } else if (content.length > 5000) {
    validation.suggestions.push('Content is very long, consider shortening');
  }
  
  // Check for only whitespace
  if (content.trim().length === 0) {
    validation.isValid = false;
    validation.issues.push('Content contains only whitespace');
  }
  
  // Check for potential encoding issues
  if (content.includes('\uFFFD')) {
    validation.suggestions.push('Content may have encoding issues');
  }
  
  // Check for excessive line breaks
  const lineBreaks = (content.match(/\n/g) || []).length;
  if (lineBreaks > content.length * 0.1) {
    validation.suggestions.push('Content has many line breaks, formatting may be affected');
  }
  
  return validation;
};

/**
 * Get content safety score (0 = unsafe, 1 = completely safe)
 * @param {string} content - Content to score
 * @returns {Promise<number>} Safety score between 0 and 1
 */
export const getContentSafetyScore = async (content) => {
  if (!content || typeof content !== 'string') {
    return 0.5; // Neutral score for invalid input
  }
  
  try {
    // Start with perfect score
    let score = 1.0;
    
    // Check main content filter
    const filterResult = await filterContent(content);
    if (filterResult.blocked) {
      score -= 0.8; // Heavy penalty for blocked content
    }
    
    // Check spam indicators
    const spamResult = detectSpam(content);
    if (spamResult.isSpam) {
      score -= spamResult.confidence * 0.3; // Moderate penalty for spam
    }
    
    // Check format issues
    const formatResult = validateContentFormat(content);
    if (!formatResult.isValid) {
      score -= 0.2; // Small penalty for format issues
    }
    
    // Ensure score stays within bounds
    return Math.max(0, Math.min(1, score));
    
  } catch (error) {
    logger.error('Error calculating content safety score:', error);
    return 0.1; // Very low score for errors
  }
};