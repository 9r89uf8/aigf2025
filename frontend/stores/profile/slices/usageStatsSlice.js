/**
 * Usage Stats Slice
 * Manages user usage statistics
 */
export const createUsageStatsSlice = (set, get) => ({
  // Usage statistics
  usageStats: {
    totalMessages: 0,
    messagesRemaining: null, // null for premium users
    resetTime: null,
    messagesByCharacter: [],
    messageTypeBreakdown: {
      text: 0,
      image: 0,
      audio: 0,
    },
    mostChattedCharacters: [],
  },
  
  // Loading and error states
  isLoadingStats: false,
  statsError: null,
  
  // Actions
  setUsageStats: (stats) => set({ usageStats: stats }),
  
  updateUsageStats: (updates) => set((state) => ({
    usageStats: { ...state.usageStats, ...updates }
  })),
  
  // Update specific usage metrics
  updateMessagesRemaining: (remaining) => set((state) => ({
    usageStats: { ...state.usageStats, messagesRemaining: remaining }
  })),
  
  updateMessageTypeCount: (type, count) => set((state) => ({
    usageStats: {
      ...state.usageStats,
      messageTypeBreakdown: {
        ...state.usageStats.messageTypeBreakdown,
        [type]: count
      }
    }
  })),
  
  // Loading state setters
  setLoadingStats: (isLoading) => set({ isLoadingStats: isLoading }),
  setStatsError: (error) => set({ statsError: error }),
  
  // Clear stats errors
  clearStatsError: () => set({ statsError: null }),
});