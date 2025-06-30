/**
 * Profile Service
 * Utility functions for profile-related operations
 * Note: Most API calls are now handled by the profile store
 */

const profileService = {

  /**
   * Validate avatar file
   * @param {File} file - File to validate
   * @returns {Object} Validation result
   */
  validateAvatarFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!file) {
      return { valid: false, error: 'No file selected' };
    }
    
    if (!allowedTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' 
      };
    }
    
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: 'File too large. Maximum size is 5MB.' 
      };
    }
    
    return { valid: true };
  },

  /**
   * Format usage stats for display
   * @param {Object} stats - Raw usage statistics
   * @returns {Object} Formatted statistics
   */
  formatUsageStats(stats) {
    const formatted = {
      totalMessages: stats.totalMessages || 0,
      messagesRemaining: stats.messagesRemaining,
      resetTime: stats.resetTime ? new Date(stats.resetTime) : null,
      messagesByCharacter: stats.messagesByCharacter || [],
      messageTypeBreakdown: {
        text: stats.textMessages || 0,
        image: stats.imageMessages || 0,
        audio: stats.audioMessages || 0,
      },
      mostChattedCharacters: stats.mostChattedCharacters || [],
    };

    // Sort characters by message count
    if (formatted.messagesByCharacter.length > 0) {
      formatted.messagesByCharacter.sort((a, b) => b.count - a.count);
    }

    return formatted;
  }
};

export default profileService;