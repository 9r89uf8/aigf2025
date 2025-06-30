/**
 * Response Personalizer - Specific Personality Modification Functions
 * 
 * This module contains specific personality modification functions that
 * add various traits and characteristics to AI responses.
 */

import logger from '../../utils/logger.js';

/**
 * Add flirtatious tone to response
 * @param {string} text - Original response text
 * @param {Object} personality - Personality settings for intensity control
 * @returns {string} Response with flirty elements added
 */
export const addFlirtyTone = (text, personality = {}) => {
  if (!text || typeof text !== 'string') return text;
  
  const intensity = personality.flirtiness || 0.5;
  let flirtyText = text;
  
  // Flirty phrases and emojis
  const flirtyElements = [
    { phrase: ' 😉', chance: 0.3 },
    { phrase: ' 💕', chance: 0.2 },
    { phrase: ' darling', chance: 0.15 },
    { phrase: ' sweetheart', chance: 0.15 },
    { phrase: ' honey', chance: 0.1 },
    { phrase: ' cutie', chance: 0.1 },
    { phrase: ' 😘', chance: 0.2 },
    { phrase: ' 💖', chance: 0.15 }
  ];
  
  // Add flirty elements based on intensity
  flirtyElements.forEach(element => {
    const adjustedChance = element.chance * intensity;
    if (Math.random() < adjustedChance) {
      flirtyText += element.phrase;
    }
  });
  
  // Flirty word replacements
  if (Math.random() < intensity * 0.4) {
    const flirtyReplacements = [
      { from: /\byou\b/gi, to: 'you gorgeous', chance: 0.1 },
      { from: /\bhello\b/gi, to: 'hey gorgeous', chance: 0.3 },
      { from: /\bhi\b/gi, to: 'hey cutie', chance: 0.3 },
      { from: /\bthanks\b/gi, to: 'thanks babe', chance: 0.2 }
    ];
    
    flirtyReplacements.forEach(replacement => {
      if (Math.random() < replacement.chance) {
        flirtyText = flirtyText.replace(replacement.from, replacement.to);
      }
    });
  }
  
  return flirtyText;
};

/**
 * Add humor elements to response
 * @param {string} text - Original response text
 * @param {Object} personality - Personality settings for humor style
 * @returns {string} Response with humor added
 */
export const addHumor = (text, personality = {}) => {
  if (!text || typeof text !== 'string') return text;
  
  const humorLevel = personality.humor || 0.5;
  const humorStyle = personality.humorStyle || 'lighthearted';
  let humorousText = text;
  
  // Add humor based on style and level
  if (Math.random() < humorLevel * 0.4) {
    switch (humorStyle) {
      case 'witty':
        humorousText = addWittyElements(humorousText);
        break;
      case 'playful':
        humorousText = addPlayfulHumor(humorousText);
        break;
      case 'sarcastic':
        humorousText = addSarcasticElements(humorousText);
        break;
      default:
        humorousText = addLightheartedHumor(humorousText);
    }
  }
  
  // Add humor emojis
  if (Math.random() < humorLevel * 0.3) {
    const humorEmojis = ['😄', '😂', '🤣', '😆', '😊', '🙃', '😋'];
    const randomEmoji = humorEmojis[Math.floor(Math.random() * humorEmojis.length)];
    humorousText += ` ${randomEmoji}`;
  }
  
  return humorousText;
};

/**
 * Add intellectual depth to response
 * @param {string} text - Original response text
 * @param {Object} personality - Personality settings for intellectual style
 * @returns {string} Response with intellectual elements added
 */
export const addIntellectualDepth = (text, personality = {}) => {
  if (!text || typeof text !== 'string') return text;
  
  const intellectLevel = personality.intelligence || 0.5;
  let intellectualText = text;
  
  // Add thoughtful phrases occasionally
  if (Math.random() < intellectLevel * 0.3) {
    const intellectualPhrases = [
      '\n\nThat\'s an interesting perspective...',
      '\n\nThis reminds me of a fascinating concept...',
      '\n\nFrom a philosophical standpoint...',
      '\n\nIt\'s worth considering...',
      '\n\nThat raises an intriguing question...',
      '\n\nInterestingly enough...'
    ];
    
    const randomPhrase = intellectualPhrases[Math.floor(Math.random() * intellectualPhrases.length)];
    intellectualText += randomPhrase;
  }
  
  // Replace simple words with more sophisticated alternatives
  if (Math.random() < intellectLevel * 0.4) {
    const sophisticatedReplacements = [
      { from: /\bvery good\b/gi, to: 'excellent', chance: 0.5 },
      { from: /\bbig\b/gi, to: 'substantial', chance: 0.3 },
      { from: /\bshow\b/gi, to: 'demonstrate', chance: 0.3 },
      { from: /\bthink about\b/gi, to: 'contemplate', chance: 0.4 },
      { from: /\bimportant\b/gi, to: 'significant', chance: 0.3 }
    ];
    
    sophisticatedReplacements.forEach(replacement => {
      if (Math.random() < replacement.chance) {
        intellectualText = intellectualText.replace(replacement.from, replacement.to);
      }
    });
  }
  
  return intellectualText;
};

/**
 * Adjust formality level of response
 * @param {string} text - Original response text
 * @param {string} level - Formality level ('very_casual', 'casual', 'formal', 'very_formal')
 * @returns {string} Response with adjusted formality
 */
export const adjustFormality = (text, level) => {
  if (!text || typeof text !== 'string') return text;
  
  let adjustedText = text;
  
  switch (level) {
    case 'very_casual':
      adjustedText = adjustedText.replace(/\byou\b/gi, 'u');
      adjustedText = adjustedText.replace(/\bwhat is\b/gi, "what's");
      adjustedText = adjustedText.replace(/\bgoing to\b/gi, 'gonna');
      adjustedText = adjustedText.replace(/\bwant to\b/gi, 'wanna');
      adjustedText = adjustedText.replace(/\bbecause\b/gi, 'cuz');
      break;
      
    case 'casual':
      adjustedText = adjustedText.replace(/\bwhat is\b/gi, "what's");
      adjustedText = adjustedText.replace(/\bit is\b/gi, "it's");
      adjustedText = adjustedText.replace(/\bthat is\b/gi, "that's");
      break;
      
    case 'formal':
      adjustedText = adjustedText.replace(/\bu\b/g, 'you');
      adjustedText = adjustedText.replace(/\bgonna\b/gi, 'going to');
      adjustedText = adjustedText.replace(/\bwanna\b/gi, 'want to');
      adjustedText = adjustedText.replace(/\bcuz\b/gi, 'because');
      adjustedText = adjustedText.replace(/\byeah\b/gi, 'yes');
      break;
      
    case 'very_formal':
      adjustedText = adjustedText.replace(/\bu\b/g, 'you');
      adjustedText = adjustedText.replace(/\bgonna\b/gi, 'going to');
      adjustedText = adjustedText.replace(/\bwanna\b/gi, 'wish to');
      adjustedText = adjustedText.replace(/\bcuz\b/gi, 'because');
      adjustedText = adjustedText.replace(/\byeah\b/gi, 'yes');
      adjustedText = adjustedText.replace(/\bokay\b/gi, 'very well');
      adjustedText = adjustedText.replace(/\bawesome\b/gi, 'excellent');
      break;
  }
  
  return adjustedText;
};

/**
 * Add appropriate emojis based on personality
 * @param {string} text - Original response text
 * @param {Object} personality - Personality settings
 * @returns {string} Response with emojis added
 */
export const addEmojis = (text, personality = {}) => {
  if (!text || typeof text !== 'string') return text;
  
  const emojiFrequency = personality.emojiUsage || 0.3;
  const traits = personality.traits || [];
  
  // Don't add emoji if text already has one
  const hasEmoji = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/u.test(text);
  if (hasEmoji) return text;
  
  // Select emoji category based on traits
  let emojiPool = ['😊', '🌟', '✨', '💫'];
  
  if (traits.includes('playful')) {
    emojiPool = [...emojiPool, '🎉', '😄', '🤗', '🙃'];
  }
  
  if (traits.includes('flirty')) {
    emojiPool = [...emojiPool, '😉', '💕', '😘', '💖'];
  }
  
  if (traits.includes('mysterious')) {
    emojiPool = [...emojiPool, '🌙', '✨', '🔮', '💫'];
  }
  
  if (traits.includes('compassionate')) {
    emojiPool = [...emojiPool, '💙', '🤗', '💕', '🌸'];
  }
  
  // Add emoji with specified frequency
  if (Math.random() < emojiFrequency) {
    const randomEmoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];
    return `${text} ${randomEmoji}`;
  }
  
  return text;
};

/**
 * Add playful elements to response
 * @param {string} text - Original response text
 * @param {Object} personality - Personality settings
 * @returns {string} Response with playful elements added
 */
export const addPlayfulElements = (text, personality = {}) => {
  if (!text || typeof text !== 'string') return text;
  
  const playfulness = personality.playfulness || 0.5;
  let playfulText = text;
  
  // Playful interjections
  if (Math.random() < playfulness * 0.3) {
    const playfulInterjections = [
      'Ooh, ',
      'Hehe, ',
      'Oh my, ',
      'Wow, ',
      'Yay! '
    ];
    
    const randomInterjection = playfulInterjections[Math.floor(Math.random() * playfulInterjections.length)];
    playfulText = randomInterjection + playfulText;
  }
  
  // Playful endings
  if (Math.random() < playfulness * 0.4) {
    const playfulEndings = [
      '~',
      ' hehe',
      ' teehee',
      '!'
    ];
    
    const randomEnding = playfulEndings[Math.floor(Math.random() * playfulEndings.length)];
    playfulText += randomEnding;
  }
  
  return playfulText;
};

/**
 * Add mysterious elements to response
 * @param {string} text - Original response text
 * @param {Object} personality - Personality settings
 * @returns {string} Response with mysterious elements added
 */
export const addMysteriousElements = (text, personality = {}) => {
  if (!text || typeof text !== 'string') return text;
  
  const mysteriousness = personality.mysteriousness || 0.5;
  let mysteriousText = text;
  
  // Mysterious phrases
  if (Math.random() < mysteriousness * 0.3) {
    const mysteriousPhrases = [
      '...',
      '\n\nCurious...',
      '\n\nHow intriguing...',
      '\n\nThere\'s more to this than meets the eye...'
    ];
    
    const randomPhrase = mysteriousPhrases[Math.floor(Math.random() * mysteriousPhrases.length)];
    mysteriousText += randomPhrase;
  }
  
  return mysteriousText;
};

/**
 * Add compassionate elements to response
 * @param {string} text - Original response text
 * @param {Object} personality - Personality settings
 * @returns {string} Response with compassionate elements added
 */
export const addCompassionateElements = (text, personality = {}) => {
  if (!text || typeof text !== 'string') return text;
  
  const compassion = personality.compassion || 0.5;
  let compassionateText = text;
  
  // Gentle, caring language modifications
  if (Math.random() < compassion * 0.4) {
    const compassionateReplacements = [
      { from: /\bI think\b/gi, to: 'I feel', chance: 0.3 },
      { from: /\bthat's good\b/gi, to: 'that warms my heart', chance: 0.4 },
      { from: /\bI understand\b/gi, to: 'I hear you', chance: 0.3 }
    ];
    
    compassionateReplacements.forEach(replacement => {
      if (Math.random() < replacement.chance) {
        compassionateText = compassionateText.replace(replacement.from, replacement.to);
      }
    });
  }
  
  return compassionateText;
};

// Helper functions for specific humor styles

const addWittyElements = (text) => {
  const wittyPhrases = [
    '\n\n*raises eyebrow*',
    '\n\nCleverly put...',
    '\n\nI see what you did there!'
  ];
  
  if (Math.random() < 0.3) {
    const randomPhrase = wittyPhrases[Math.floor(Math.random() * wittyPhrases.length)];
    return text + randomPhrase;
  }
  
  return text;
};

const addPlayfulHumor = (text) => {
  const playfulElements = [
    ' *giggles*',
    ' hehe',
    ' *winks*'
  ];
  
  if (Math.random() < 0.4) {
    const randomElement = playfulElements[Math.floor(Math.random() * playfulElements.length)];
    return text + randomElement;
  }
  
  return text;
};

const addSarcasticElements = (text) => {
  // Light sarcasm only - avoid being mean
  const sarcasticPhrases = [
    '\n\nOh, absolutely...',
    '\n\nSure, sure...',
    '\n\nRiiiight...'
  ];
  
  if (Math.random() < 0.2) {
    const randomPhrase = sarcasticPhrases[Math.floor(Math.random() * sarcasticPhrases.length)];
    return text + randomPhrase;
  }
  
  return text;
};

const addLightheartedHumor = (text) => {
  const lightheartedElements = [
    ' 😄',
    ' *chuckles*',
    ' *smiles*'
  ];
  
  if (Math.random() < 0.3) {
    const randomElement = lightheartedElements[Math.floor(Math.random() * lightheartedElements.length)];
    return text + randomElement;
  }
  
  return text;
};