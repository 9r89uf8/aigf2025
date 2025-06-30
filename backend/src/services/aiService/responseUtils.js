/**
 * Response Utils - Utility Functions for Response Processing
 * 
 * This module contains utility functions for response processing including
 * quality assessment, smart truncation, and response validation.
 */

import logger from '../../utils/logger.js';

/**
 * Check if response is incomplete or truncated
 * @param {string} response - Response to check
 * @returns {boolean} True if response appears incomplete
 */
export const isResponseIncomplete = (response) => {
  if (!response || typeof response !== 'string') {
    return true;
  }
  
  const trimmed = response.trim();
  
  // Empty response
  if (trimmed.length === 0) {
    return true;
  }
  
  // Check for proper sentence ending (punctuation or emoji)
  const validEndingPattern = /[.!?]$|[\u{1F600}-\u{1F64F}]$|[\u{1F300}-\u{1F5FF}]$|[\u{1F680}-\u{1F6FF}]$|[\u{1F700}-\u{1F77F}]$|[\u{1F780}-\u{1F7FF}]$|[\u{1F800}-\u{1F8FF}]$|[\u{2600}-\u{26FF}]$|[\u{2700}-\u{27BF}]$/u;
  
  if (!trimmed.match(validEndingPattern)) {
    return true;
  }
  
  // Log emoji endings for monitoring
  const emojiEndingPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]$/u;
  if (emojiEndingPattern.test(trimmed)) {
    logger.debug('Response ends with emoji - marked as complete', {
      response: trimmed,
      endingChar: trimmed.slice(-2) // Get last 2 chars to capture emoji
    });
  }
  
  // Check for common incomplete patterns (words that suggest continuation)
  const incompletePatterns = [
    /\b(then|and|but|so|because|when|while|if|that|which|who)\s*[.!?]?$/i,
    /\b(the|a|an|this|that|these|those)\s*[.!?]?$/i,
    /\b(is|are|was|were|will|would|could|should|can|may|might)\s*[.!?]?$/i,
    /\b(in|on|at|by|for|with|to|from|of|about)\s*[.!?]?$/i,
    /\b(very|really|quite|more|most|less|much|many)\s*[.!?]?$/i
  ];
  
  // Remove trailing punctuation and emojis for pattern matching
  const withoutPunctuation = trimmed.replace(/[.!?]*$/, '').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]*$/u, '');
  
  return incompletePatterns.some(pattern => pattern.test(withoutPunctuation));
};

/**
 * Smart truncation at sentence boundaries
 * @param {string} response - Response to truncate
 * @param {number} maxLength - Maximum allowed length (default: 200)
 * @returns {string} Truncated response
 */
export const smartTruncate = (response, maxLength = 200) => {
  if (!response || response.length <= maxLength) {
    return response;
  }
  
  // Find sentences using punctuation
  const sentences = response.match(/[^.!?]*[.!?]+/g) || [];
  let truncated = '';
  
  // Build response from complete sentences within limit
  for (const sentence of sentences) {
    const nextLength = (truncated + sentence).length;
    if (nextLength > maxLength) {
      break;
    }
    truncated += sentence;
  }
  
  // If we have complete sentences, use them
  if (truncated.trim().length > 0) {
    return truncated.trim();
  }
  
  // Fallback: cut at word boundary with ellipsis
  const words = response.split(' ');
  let wordTruncated = '';
  
  for (const word of words) {
    const nextLength = (wordTruncated + ' ' + word).length;
    if (nextLength > maxLength - 3) { // Leave space for "..."
      break;
    }
    wordTruncated += (wordTruncated ? ' ' : '') + word;
  }
  
  return wordTruncated + '...';
};

/**
 * Assess response quality and length
 * @param {string} response - Response to assess
 * @returns {Object} Quality assessment object
 */
export const assessResponseQuality = (response) => {
  const assessment = {
    isComplete: true,
    isTooLong: false,
    needsRetry: false,
    reason: null,
    characterCount: response.length,
    wordCount: response.split(/\s+/).length,
    sentenceCount: 0,
    score: 1.0 // Quality score from 0-1
  };
  
  // Count sentences
  const sentences = (response.match(/[.!?]+/g) || []).length;
  assessment.sentenceCount = sentences;
  
  // Check if incomplete
  if (isResponseIncomplete(response)) {
    assessment.isComplete = false;
    assessment.needsRetry = true;
    assessment.reason = 'incomplete_response';
    assessment.score *= 0.3;
  }
  
  // Check if too long (over 2 sentences or 200 characters)
  if (sentences > 2 || response.length > 200) {
    assessment.isTooLong = true;
    assessment.reason = assessment.reason || 'too_long';
    assessment.score *= 0.8;
  }
  
  // Check for very short responses
  if (response.trim().length < 5) {
    assessment.needsRetry = true;
    assessment.reason = assessment.reason || 'too_short';
    assessment.score *= 0.2;
  }
  
  // Check for repetitive content
  const repetitionScore = assessRepetition(response);
  if (repetitionScore < 0.7) {
    assessment.score *= repetitionScore;
    assessment.reason = assessment.reason || 'repetitive_content';
  }
  
  // Check for coherence
  const coherenceScore = assessCoherence(response);
  assessment.score *= coherenceScore;
  
  return assessment;
};

/**
 * Assess repetition in response
 * @param {string} response - Response to assess
 * @returns {number} Repetition score (0-1, higher is better)
 */
export const assessRepetition = (response) => {
  if (!response || response.length < 20) {
    return 1.0; // Short responses get benefit of doubt
  }
  
  const words = response.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  
  // Basic repetition ratio
  const uniquenessRatio = uniqueWords.size / words.length;
  
  // Check for phrase repetition
  const phrases = [];
  for (let i = 0; i < words.length - 2; i++) {
    phrases.push(words.slice(i, i + 3).join(' '));
  }
  
  const uniquePhrases = new Set(phrases);
  const phraseUniquenessRatio = phrases.length > 0 ? uniquePhrases.size / phrases.length : 1;
  
  // Combine metrics
  return Math.min(uniquenessRatio * 1.2, phraseUniquenessRatio * 1.5, 1.0);
};

/**
 * Assess response coherence
 * @param {string} response - Response to assess
 * @returns {number} Coherence score (0-1, higher is better)
 */
export const assessCoherence = (response) => {
  if (!response || response.length < 10) {
    return 0.5; // Neutral score for very short responses
  }
  
  let score = 1.0;
  
  // Check for proper capitalization
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const properlyCapitalized = sentences.filter(s => 
    s.trim().length > 0 && /^[A-Z]/.test(s.trim())
  ).length;
  
  if (sentences.length > 0) {
    const capitalizationRatio = properlyCapitalized / sentences.length;
    score *= Math.max(0.5, capitalizationRatio);
  }
  
  // Check for logical flow indicators
  const flowIndicators = /\b(however|therefore|meanwhile|furthermore|additionally|consequently|thus|hence)\b/gi;
  const hasFlowIndicators = flowIndicators.test(response);
  if (hasFlowIndicators && response.length > 100) {
    score *= 1.1; // Bonus for good flow
  }
  
  // Check for abrupt endings
  const endsAbruptly = /\b(and|but|so|because|when|while|if|that|which|who)\s*[.!?]?$/i.test(response.trim());
  if (endsAbruptly) {
    score *= 0.7;
  }
  
  return Math.min(score, 1.0);
};

/**
 * Calculate response readability score
 * @param {string} response - Response to analyze
 * @returns {Object} Readability metrics
 */
export const calculateReadability = (response) => {
  if (!response || typeof response !== 'string') {
    return { error: 'Invalid response' };
  }
  
  const words = response.split(/\s+/).filter(word => word.length > 0);
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0);
  
  const metrics = {
    wordCount: words.length,
    sentenceCount: sentences.length,
    syllableCount: syllables,
    averageWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
    averageSyllablesPerWord: words.length > 0 ? syllables / words.length : 0,
    readabilityScore: 0
  };
  
  // Simple readability score (lower is easier to read)
  if (sentences.length > 0 && words.length > 0) {
    metrics.readabilityScore = 206.835 - 
      (1.015 * metrics.averageWordsPerSentence) - 
      (84.6 * metrics.averageSyllablesPerWord);
  }
  
  return metrics;
};

/**
 * Count syllables in a word (approximate)
 * @param {string} word - Word to count syllables for
 * @returns {number} Estimated syllable count
 */
const countSyllables = (word) => {
  if (!word || word.length === 0) return 0;
  
  word = word.toLowerCase();
  let count = 0;
  let previousWasVowel = false;
  
  for (let i = 0; i < word.length; i++) {
    const isVowel = 'aeiouy'.includes(word[i]);
    if (isVowel && !previousWasVowel) {
      count++;
    }
    previousWasVowel = isVowel;
  }
  
  // Adjust for silent 'e'
  if (word.endsWith('e') && count > 1) {
    count--;
  }
  
  return Math.max(1, count);
};

/**
 * Validate response format and structure
 * @param {string} response - Response to validate
 * @returns {Object} Validation result
 */
export const validateResponseStructure = (response) => {
  const validation = {
    isValid: true,
    issues: [],
    suggestions: [],
    score: 1.0
  };
  
  if (!response || typeof response !== 'string') {
    validation.isValid = false;
    validation.issues.push('Response is not a valid string');
    return validation;
  }
  
  // Check for empty response
  if (response.trim().length === 0) {
    validation.isValid = false;
    validation.issues.push('Response is empty');
    validation.score = 0;
    return validation;
  }
  
  // Check for excessive punctuation
  const punctuationRatio = (response.match(/[.!?;:,]/g) || []).length / response.length;
  if (punctuationRatio > 0.2) {
    validation.suggestions.push('Response has excessive punctuation');
    validation.score *= 0.9;
  }
  
  // Check for proper sentence structure
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const veryShortSentences = sentences.filter(s => s.trim().split(/\s+/).length < 3).length;
  
  if (veryShortSentences > sentences.length * 0.5) {
    validation.suggestions.push('Many very short sentences detected');
    validation.score *= 0.8;
  }
  
  // Check for unbalanced quotes or parentheses
  const openQuotes = (response.match(/"/g) || []).length;
  const openParens = (response.match(/\(/g) || []).length;
  const closeParens = (response.match(/\)/g) || []).length;
  
  if (openQuotes % 2 !== 0) {
    validation.issues.push('Unmatched quotation marks');
    validation.score *= 0.7;
  }
  
  if (openParens !== closeParens) {
    validation.issues.push('Unmatched parentheses');
    validation.score *= 0.7;
  }
  
  validation.isValid = validation.issues.length === 0;
  
  return validation;
};

/**
 * Get comprehensive response metrics
 * @param {string} response - Response to analyze
 * @returns {Object} Complete metrics object
 */
export const getResponseMetrics = (response) => {
  if (!response || typeof response !== 'string') {
    return { error: 'Invalid response' };
  }
  
  const quality = assessResponseQuality(response);
  const readability = calculateReadability(response);
  const structure = validateResponseStructure(response);
  const repetition = assessRepetition(response);
  const coherence = assessCoherence(response);
  
  return {
    quality,
    readability,
    structure,
    repetition,
    coherence,
    overall: {
      score: (quality.score + structure.score + repetition + coherence) / 4,
      isAcceptable: quality.isComplete && structure.isValid && repetition > 0.5,
      needsImprovement: quality.needsRetry || !structure.isValid || repetition < 0.5
    }
  };
};