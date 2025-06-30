/**
 * AI Service - Compatibility Bridge
 * 
 * This file maintains backward compatibility by re-exporting
 * the refactored AI Service from the new modular structure.
 */
import { generateAIResponse } from './aiService/index.js';

// Re-export the main function for backward compatibility
export { generateAIResponse };

// Default export for existing imports
export default {
  generateAIResponse
};