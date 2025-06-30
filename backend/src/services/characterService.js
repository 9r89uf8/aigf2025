/**
 * Character service
 * Handles all character-related database operations with caching
 */
import { getFirebaseFirestore } from '../config/firebase.js';
import { 
  defaultCharacter, 
  validateCharacter, 
  sanitizeCharacter,
  calculatePopularity 
} from '../models/Character.js';
import { ApiError } from '../middleware/errorHandler.js';
import cache from './cacheService.js';
import { config } from '../config/environment.js';
import logger from '../utils/logger.js';

const CHARACTERS_COLLECTION = 'characters';

/**
 * Helper function to fetch and process characters from Firestore
 * @param {Array} tags - Tag filters
 * @param {boolean|null} isPremiumOnly - Premium filter
 * @param {string} searchQuery - Search query
 * @param {string} sortBy - Sort field
 * @param {string} sortOrder - Sort order
 * @returns {Promise<Array>} Processed characters array
 */
const fetchAndProcessCharacters = async (tags = [], isPremiumOnly = null, searchQuery = '', sortBy = 'popularity', sortOrder = 'desc') => {
  const firestore = getFirebaseFirestore();
  let query = firestore.collection(CHARACTERS_COLLECTION)
    .where('isActive', '==', true);
  
  // Apply filters
  if (isPremiumOnly !== null) {
    query = query.where('isPremiumOnly', '==', isPremiumOnly);
  }
  
  if (tags.length > 0) {
    query = query.where('tags', 'array-contains-any', tags);
  }
  
  // Get all matching characters
  const snapshot = await query.get();
  let characters = [];
  
  snapshot.forEach(doc => {
    const character = { id: doc.id, ...doc.data() };
    character.popularity = calculatePopularity(character.stats);
    
    // Apply search filter if provided
    if (!searchQuery || 
        character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        character.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      characters.push(character);
    }
  });
  
  // Sort characters
  characters.sort((a, b) => {
    switch (sortBy) {
      case 'popularity':
        return sortOrder === 'desc' ? b.popularity - a.popularity : a.popularity - b.popularity;
      case 'name':
        return sortOrder === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      case 'createdAt':
        return sortOrder === 'desc' 
          ? new Date(b.createdAt) - new Date(a.createdAt) 
          : new Date(a.createdAt) - new Date(b.createdAt);
      default:
        return 0;
    }
  });
  
  return characters;
};

/**
 * Create a new character
 * @param {Object} characterData - Character data
 * @returns {Promise<Object>} Created character
 */
export const createCharacter = async (characterData) => {
  try {
    const firestore = getFirebaseFirestore();
    
    // Validate character data
    const validation = validateCharacter(characterData);
    if (!validation.isValid) {
      throw new ApiError(400, `Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Create character document
    const newCharacter = {
      ...defaultCharacter,
      ...characterData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Generate ID
    const docRef = await firestore.collection(CHARACTERS_COLLECTION).add(newCharacter);
    const character = { id: docRef.id, ...newCharacter };
    
    // Cache the character
    await cache.set(cache.keys.character(docRef.id), character, config.redis.ttl.character);
    
    // Invalidate character list cache
    await cache.del(cache.keys.characterList());
    
    logger.info('Character created', { characterId: docRef.id, name: character.name });
    return character;
  } catch (error) {
    logger.error('Error creating character:', error);
    throw error;
  }
};

/**
 * Get character by ID
 * @param {string} characterId - Character ID
 * @returns {Promise<Object|null>} Character data or null
 */
export const getCharacterById = async (characterId) => {
  try {
    const cacheKey = cache.keys.character(characterId);
    
    return await cache.getOrSet(cacheKey, async () => {
      // Get from Firestore
      const firestore = getFirebaseFirestore();
      const characterDoc = await firestore.collection(CHARACTERS_COLLECTION).doc(characterId).get();
      
      if (!characterDoc.exists) {
        return null;
      }
      
      const character = { id: characterDoc.id, ...characterDoc.data() };
      
      // Update popularity score
      character.popularity = calculatePopularity(character.stats);
      
      return character;
    }, config.redis.ttl.character);
  } catch (error) {
    logger.error('Error getting character:', error);
    throw error;
  }
};

/**
 * Get all active characters
 * @param {Object} options - Query options
 * @returns {Promise<Object[]>} List of characters
 */
export const getAllCharacters = async (options = {}) => {
  const {
    limit = 50,
    offset = 0,
    sortBy = 'popularity',
    sortOrder = 'desc',
    tags = [],
    isPremiumOnly = null,
    searchQuery = ''
  } = options;
  
  try {
    // Use cache for default query (no filters)
    if (!searchQuery && tags.length === 0 && isPremiumOnly === null && offset === 0) {
      const cacheKey = cache.keys.characterList();
      
      const characters = await cache.getOrSet(cacheKey, async () => {
        return await fetchAndProcessCharacters(tags, isPremiumOnly, searchQuery, sortBy, sortOrder);
      }, config.redis.ttl.character);
      
      const paginatedList = characters.slice(0, limit);
      return {
        characters: paginatedList,
        total: characters.length,
        limit,
        offset: 0,
        hasMore: limit < characters.length
      };
    }
    
    // For filtered queries, fetch directly without caching
    const characters = await fetchAndProcessCharacters(tags, isPremiumOnly, searchQuery, sortBy, sortOrder);
    
    // Apply pagination
    const paginatedCharacters = characters.slice(offset, offset + limit);
    
    return {
      characters: paginatedCharacters,
      total: characters.length,
      limit,
      offset,
      hasMore: offset + limit < characters.length
    };
  } catch (error) {
    logger.error('Error getting characters:', error);
    throw error;
  }
};

/**
 * Update character data
 * @param {string} characterId - Character ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated character
 */
export const updateCharacter = async (characterId, updates) => {
  try {
    const firestore = getFirebaseFirestore();
    
    // Remove protected fields
    const { id, createdAt, stats, ...safeUpdates } = updates;
    
    // Add update timestamp
    safeUpdates.updatedAt = new Date();
    
    // Validate if updating critical fields
    if (safeUpdates.name || safeUpdates.description || safeUpdates.avatar) {
      const currentCharacter = await getCharacterById(characterId);
      const updatedCharacter = { ...currentCharacter, ...safeUpdates };
      
      const validation = validateCharacter(updatedCharacter);
      if (!validation.isValid) {
        throw new ApiError(400, `Validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    await firestore.collection(CHARACTERS_COLLECTION).doc(characterId).update(safeUpdates);
    
    // Invalidate caches
    await cache.del(cache.keys.character(characterId));
    await cache.del(cache.keys.characterList());
    await cache.del(cache.keys.characterPrompt(characterId));
    await cache.del(cache.keys.characterStats(characterId));
    
    const updatedCharacter = await getCharacterById(characterId);
    logger.info('Character updated', { characterId });
    
    return updatedCharacter;
  } catch (error) {
    logger.error('Error updating character:', error);
    throw error;
  }
};

/**
 * Get character statistics with caching
 * @param {string} characterId - Character ID
 * @returns {Promise<Object|null>} Character stats or null
 */
export const getCharacterStats = async (characterId) => {
  try {
    const cacheKey = cache.keys.characterStats(characterId);
    
    return await cache.getOrSet(cacheKey, async () => {
      const character = await getCharacterById(characterId);
      
      if (!character) {
        return null;
      }
      
      return {
        characterId,
        stats: character.stats || {},
        popularity: character.popularity || 0,
        lastUpdated: character.updatedAt
      };
    }, 600); // Cache for 10 minutes - stats change more frequently
  } catch (error) {
    logger.error('Error getting character stats:', error);
    throw error;
  }
};

/**
 * Update character statistics
 * @param {string} characterId - Character ID
 * @param {Object} statUpdates - Statistics to update
 * @returns {Promise<void>}
 */
export const updateCharacterStats = async (characterId, statUpdates) => {
  try {
    const firestore = getFirebaseFirestore();
    
    // Prepare updates
    const updates = {
      updatedAt: new Date()
    };
    
    // Add stat updates with 'stats.' prefix
    Object.entries(statUpdates).forEach(([key, value]) => {
      updates[`stats.${key}`] = value;
    });
    
    await firestore.collection(CHARACTERS_COLLECTION).doc(characterId).update(updates);
    
    // Invalidate caches
    await cache.del(cache.keys.character(characterId));
    await cache.del(cache.keys.characterStats(characterId));
    
    logger.debug('Character stats updated', { characterId, statUpdates });
  } catch (error) {
    logger.error('Error updating character stats:', error);
    // Don't throw - stat updates shouldn't break the flow
  }
};

/**
 * Add gallery item to character
 * @param {string} characterId - Character ID
 * @param {Object} galleryItem - Gallery item data
 * @returns {Promise<Object>} Updated character
 */
export const addGalleryItem = async (characterId, galleryItem) => {
  try {
    const firestore = getFirebaseFirestore();
    const character = await getCharacterById(characterId);
    
    if (!character) {
      throw new ApiError(404, 'Character not found');
    }
    
    // Generate gallery item ID
    const itemId = firestore.collection('_').doc().id;
    const newItem = {
      id: itemId,
      ...galleryItem,
      uploadedAt: new Date()
    };
    
    // Add to gallery array
    const updatedGallery = [...(character.gallery || []), newItem];
    
    await firestore.collection(CHARACTERS_COLLECTION).doc(characterId).update({
      gallery: updatedGallery,
      updatedAt: new Date()
    });
    
    // Invalidate caches
    await cache.del(cache.keys.character(characterId));
    await cache.del(cache.keys.characterGallery(characterId));
    
    logger.info('Gallery item added', { characterId, itemId });
    
    return await getCharacterById(characterId);
  } catch (error) {
    logger.error('Error adding gallery item:', error);
    throw error;
  }
};

/**
 * Remove gallery item from character
 * @param {string} characterId - Character ID
 * @param {string} itemId - Gallery item ID
 * @returns {Promise<Object>} Updated character
 */
export const removeGalleryItem = async (characterId, itemId) => {
  try {
    const firestore = getFirebaseFirestore();
    const character = await getCharacterById(characterId);
    
    if (!character) {
      throw new ApiError(404, 'Character not found');
    }
    
    // Filter out the item
    const updatedGallery = (character.gallery || []).filter(item => item.id !== itemId);
    
    await firestore.collection(CHARACTERS_COLLECTION).doc(characterId).update({
      gallery: updatedGallery,
      updatedAt: new Date()
    });
    
    // Invalidate caches
    await cache.del(cache.keys.character(characterId));
    await cache.del(cache.keys.characterGallery(characterId));
    
    logger.info('Gallery item removed', { characterId, itemId });
    
    return await getCharacterById(characterId);
  } catch (error) {
    logger.error('Error removing gallery item:', error);
    throw error;
  }
};

/**
 * Get character's gallery
 * @param {string} characterId - Character ID
 * @param {boolean} isPremium - User premium status
 * @returns {Promise<Object[]>} Gallery items
 */
export const getCharacterGallery = async (characterId, isPremium = false) => {
  try {
    const cacheKey = cache.keys.characterGallery(characterId);
    
    const galleryData = await cache.getOrSet(cacheKey, async () => {
      const character = await getCharacterById(characterId);
      
      if (!character) {
        return null;
      }
      
      return {
        gallery: character.gallery || [],
        totalCount: (character.gallery || []).length,
        premiumCount: (character.gallery || []).filter(item => item.isPremiumOnly).length
      };
    }, 7200); // Cache for 2 hours - gallery data changes less frequently
    
    if (!galleryData) {
      throw new ApiError(404, 'Character not found');
    }
    
    let gallery = galleryData.gallery;
    
    // Filter premium items for non-premium users
    if (!isPremium) {
      gallery = gallery.filter(item => !item.isPremiumOnly);
    }
    
    return {
      gallery,
      totalCount: galleryData.totalCount,
      premiumCount: galleryData.premiumCount
    };
  } catch (error) {
    logger.error('Error getting character gallery:', error);
    throw error;
  }
};

/**
 * Increment gallery item views
 * @param {string} characterId - Character ID
 * @param {string} itemId - Gallery item ID
 * @returns {Promise<void>}
 */
export const incrementGalleryViews = async (characterId, itemId) => {
  try {
    const firestore = getFirebaseFirestore();
    const character = await getCharacterById(characterId);
    
    if (!character) return;
    
    // Update view count
    const updatedGallery = (character.gallery || []).map(item => {
      if (item.id === itemId) {
        return { ...item, views: (item.views || 0) + 1 };
      }
      return item;
    });
    
    await firestore.collection(CHARACTERS_COLLECTION).doc(characterId).update({
      gallery: updatedGallery
    });
    
    // Invalidate caches
    await cache.del(cache.keys.character(characterId));
    await cache.del(cache.keys.characterGallery(characterId));
  } catch (error) {
    logger.error('Error incrementing gallery views:', error);
    // Don't throw - view tracking shouldn't break the flow
  }
};

/**
 * Delete character (soft delete)
 * @param {string} characterId - Character ID
 * @returns {Promise<void>}
 */
export const deleteCharacter = async (characterId) => {
  try {
    const firestore = getFirebaseFirestore();
    
    await firestore.collection(CHARACTERS_COLLECTION).doc(characterId).update({
      isActive: false,
      updatedAt: new Date()
    });
    
    // Invalidate caches
    await cache.del(cache.keys.character(characterId));
    await cache.del(cache.keys.characterList());
    await cache.del(cache.keys.characterPrompt(characterId));
    await cache.del(cache.keys.characterStats(characterId));
    await cache.del(cache.keys.characterGallery(characterId));
    
    logger.info('Character deactivated', { characterId });
  } catch (error) {
    logger.error('Error deleting character:', error);
    throw error;
  }
};

export default {
  createCharacter,
  getCharacterById,
  getAllCharacters,
  updateCharacter,
  getCharacterStats,
  updateCharacterStats,
  addGalleryItem,
  removeGalleryItem,
  getCharacterGallery,
  incrementGalleryViews,
  deleteCharacter
}; 