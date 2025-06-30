/**
 * Usage Slice
 * Manages character usage tracking and limits
 */
import { apiClient } from '../../../lib/api/client';

export const createUsageSlice = (set, get) => ({
    // Usage tracking - per character
    characterUsage: new Map(), // characterId -> { text: {used, limit}, image: {used, limit}, audio: {used, limit} }

    /**
     * Fetch initial usage data from backend
     */
    fetchInitialUsage: async () => {
        try {
            console.log('🔄 FRONTEND DEBUG: Fetching usage data from /auth/usage...');
            const response = await apiClient.get('/auth/usage');
            console.log('📥 FRONTEND DEBUG: Raw response:', response.data);
            
            const usageData = response.data.usage;
            console.log('📊 FRONTEND DEBUG: Usage data extracted:', usageData);
            
            const characterUsageMap = new Map();

            // Store usage per character
            if (usageData && typeof usageData === 'object') {
                console.log('🔍 FRONTEND DEBUG: Processing usage data...');
                Object.entries(usageData).forEach(([characterId, usage]) => {
                    console.log('👤 FRONTEND DEBUG: Processing character:', {
                        characterId,
                        usage,
                        usageType: typeof usage
                    });
                    
                    if (usage && typeof usage === 'object') {
                        const characterUsage = {
                            text: { used: usage.text || 0, limit: 30 },
                            image: { used: usage.image || 0, limit: 5 },
                            audio: { used: usage.audio || 0, limit: 5 }
                        };
                        
                        console.log('✅ FRONTEND DEBUG: Setting character usage:', {
                            characterId,
                            characterUsage
                        });
                        
                        characterUsageMap.set(characterId, characterUsage);
                    }
                });
            }

            set({ characterUsage: characterUsageMap });
            console.log('🎯 FRONTEND DEBUG: Final characterUsageMap:', characterUsageMap);
            console.log('🎯 FRONTEND DEBUG: CharacterUsageMap entries:', Array.from(characterUsageMap.entries()));
        } catch (error) {
            console.error('🚫 FRONTEND DEBUG: Failed to fetch initial usage:', error);
            // Don't show error toast for this - it's not critical for chat functionality
        }
    },

    /**
     * Get usage for specific character
     */
    getCharacterUsage: (characterId) => {
        const { characterUsage } = get();
        return characterUsage.get(characterId) || {
            text: { used: 0, limit: 30 },
            image: { used: 0, limit: 5 },
            audio: { used: 0, limit: 5 }
        };
    },

    /**
     * Update usage for specific character
     */
    updateCharacterUsage: (characterId, usage) => {
        set(state => {
            const newCharacterUsage = new Map(state.characterUsage);
            newCharacterUsage.set(characterId, usage);
            return { characterUsage: newCharacterUsage };
        });
    },

    /**
     * Refresh usage for current character after sending message
     */
    refreshCharacterUsage: async (characterId) => {
        try {
            console.log(`🔄 FRONTEND DEBUG: Refreshing usage for character ${characterId}...`);
            const response = await apiClient.get('/auth/usage');
            console.log('📥 FRONTEND DEBUG: Refresh response:', response.data);
            
            const usageData = response.data.usage;
            console.log('📊 FRONTEND DEBUG: Usage data for refresh:', usageData);
            
            if (usageData && usageData[characterId]) {
                const usage = usageData[characterId];
                console.log('👤 FRONTEND DEBUG: Character usage found:', {
                    characterId,
                    usage
                });
                
                const updatedUsage = {
                    text: { used: usage.text || 0, limit: 30 },
                    image: { used: usage.image || 0, limit: 5 },
                    audio: { used: usage.audio || 0, limit: 5 }
                };
                
                console.log('✅ FRONTEND DEBUG: Updating character usage:', {
                    characterId,
                    updatedUsage
                });
                
                get().updateCharacterUsage(characterId, updatedUsage);
            } else {
                console.log('❌ FRONTEND DEBUG: No usage data found for character:', {
                    characterId,
                    availableCharacters: Object.keys(usageData || {})
                });
            }
        } catch (error) {
            console.error('Failed to refresh character usage:', error);
        }
    },

    /**
     * Update usage (from WebSocket event)
     */
    updateUsage: (data) => {
        // This method is called by socket event handler
        // The data structure depends on how backend sends it
        console.log('📊 Usage update received:', data);
        
        if (data.characterId && data.usage) {
            get().updateCharacterUsage(data.characterId, data.usage);
        }
    }
});