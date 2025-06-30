/**
 * User service
 * Handles all user-related database operations
 */
import { getFirebaseFirestore, getFirebaseAuth } from '../config/firebase.js';
import { defaultUser, validateUser, sanitizeUser } from '../models/User.js';
import { ApiError } from '../middleware/errorHandler.js';
import cache from './cacheService.js';
import { config } from '../config/environment.js';
import logger from '../utils/logger.js';

const USERS_COLLECTION = 'users';

/**
 * Create a new user in Firestore
 * @param {string} uid - Firebase Auth UID
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
export const createUser = async (uid, userData) => {
  try {
    const firestore = getFirebaseFirestore();
    
    // Validate user data
    const validation = validateUser(userData);
    if (!validation.isValid) {
      throw new ApiError(400, `Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Check if username is already taken
    const usernameExists = await isUsernameTaken(userData.username);
    if (usernameExists) {
      throw new ApiError(400, 'Username is already taken');
    }
    
    // Create user document
    const newUser = {
      ...defaultUser,
      ...userData,
      uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date()
    };
    
    await firestore.collection(USERS_COLLECTION).doc(uid).set(newUser);
    
    logger.info('User created', { uid, username: newUser.username });
    return newUser;
  } catch (error) {
    logger.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Get user by ID
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} User data or null
 */
export const getUserById = async (uid) => {
  try {
    const cacheKey = cache.keys.user(uid);
    
    return await cache.getOrSet(cacheKey, async () => {
      // Get from Firestore
      const firestore = getFirebaseFirestore();
      const userDoc = await firestore.collection(USERS_COLLECTION).doc(uid).get();
      
      if (!userDoc.exists) {
        return null;
      }
      
      return { uid: userDoc.id, ...userDoc.data() };
    }, config.redis.ttl.userProfile);
  } catch (error) {
    logger.error('Error getting user:', error);
    throw error;
  }
};

/**
 * Get user by username
 * @param {string} username - Username
 * @returns {Promise<Object|null>} User data or null
 */
export const getUserByUsername = async (username) => {
  try {
    const cacheKey = cache.keys.userByUsername(username);
    
    return await cache.getOrSet(cacheKey, async () => {
      const firestore = getFirebaseFirestore();
      const querySnapshot = await firestore
        .collection(USERS_COLLECTION)
        .where('username', '==', username)
        .limit(1)
        .get();
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const userDoc = querySnapshot.docs[0];
      return { uid: userDoc.id, ...userDoc.data() };
    }, 3600); // Cache for 1 hour - usernames rarely change
  } catch (error) {
    logger.error('Error getting user by username:', error);
    throw error;
  }
};

/**
 * Update user data
 * @param {string} uid - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user
 */
export const updateUser = async (uid, updates) => {
  try {
    const firestore = getFirebaseFirestore();
    
    // Remove protected fields
    const { uid: _, createdAt, ...safeUpdates } = updates;
    
    // Add update timestamp
    safeUpdates.updatedAt = new Date();
    
    // Get current user data for cache invalidation
    const currentUser = await getUserById(uid);
    
    // If username is being updated, check if it's taken
    if (safeUpdates.username) {
      if (currentUser.username !== safeUpdates.username) {
        const usernameExists = await isUsernameTaken(safeUpdates.username);
        if (usernameExists) {
          throw new ApiError(400, 'Username is already taken');
        }
      }
    }
    
    await firestore.collection(USERS_COLLECTION).doc(uid).update(safeUpdates);
    
    // Invalidate caches
    const userCacheKey = cache.keys.user(uid);
    await cache.del(userCacheKey);
    
    // If username was updated, invalidate username-related caches
    if (safeUpdates.username && currentUser.username !== safeUpdates.username) {
      // Invalidate old username caches
      if (currentUser.username) {
        await cache.del(cache.keys.userByUsername(currentUser.username));
        await cache.del(cache.keys.usernameExists(currentUser.username));
      }
      // Invalidate new username caches
      await cache.del(cache.keys.userByUsername(safeUpdates.username));
      await cache.del(cache.keys.usernameExists(safeUpdates.username));
    }
    
    const updatedUser = await getUserById(uid);
    logger.info('User updated', { uid });
    
    return updatedUser;
  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Update user login timestamp
 * @param {string} uid - User ID
 * @returns {Promise<void>}
 */
export const updateLastLogin = async (uid) => {
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection(USERS_COLLECTION).doc(uid).update({
      lastLoginAt: new Date()
    });
  } catch (error) {
    logger.error('Error updating last login:', error);
  }
};

/**
 * Check if username is taken
 * @param {string} username - Username to check
 * @returns {Promise<boolean>} Is taken
 */
export const isUsernameTaken = async (username) => {
  try {
    const cacheKey = cache.keys.usernameExists(username);
    
    return await cache.getOrSet(cacheKey, async () => {
      const firestore = getFirebaseFirestore();
      const querySnapshot = await firestore
        .collection(USERS_COLLECTION)
        .where('username', '==', username)
        .limit(1)
        .get();
      
      return !querySnapshot.empty;
    }, 1800); // Cache for 30 minutes - balance between performance and accuracy
  } catch (error) {
    logger.error('Error checking username:', error);
    throw error;
  }
};

/**
 * Update user premium status
 * @param {string} uid - User ID
 * @param {boolean} isPremium - Premium status
 * @param {Date} expiresAt - Premium expiration date
 * @returns {Promise<Object>} Updated user
 */
export const updatePremiumStatus = async (uid, isPremium, expiresAt = null) => {
  try {
    const updates = {
      isPremium,
      premiumExpiresAt: expiresAt
    };
    
    return await updateUser(uid, updates);
  } catch (error) {
    logger.error('Error updating premium status:', error);
    throw error;
  }
};

/**
 * Update user premium status with extended data
 * @param {string} uid - User ID
 * @param {Object} premiumData - Premium subscription data
 * @returns {Promise<Object>} Updated user
 */
export const updateUserPremiumStatus = async (uid, premiumData) => {
  try {
    const updates = {
      isPremium: premiumData.isPremium,
      premiumExpiresAt: premiumData.premiumExpiresAt,
      stripeCustomerId: premiumData.stripeCustomerId,
      lastPaymentAmount: premiumData.lastPaymentAmount,
      lastPaymentDate: premiumData.lastPaymentDate,
      cancelledAt: premiumData.cancelledAt
    };
    
    // Remove undefined values
    Object.keys(updates).forEach(key => 
      updates[key] === undefined && delete updates[key]
    );
    
    return await updateUser(uid, updates);
  } catch (error) {
    logger.error('Error updating user premium status:', error);
    throw error;
  }
};



/**
 * Delete user account
 * @param {string} uid - User ID
 * @returns {Promise<void>}
 */
export const deleteUser = async (uid) => {
  try {
    const firestore = getFirebaseFirestore();
    const auth = getFirebaseAuth();
    
    // Delete from Firestore
    await firestore.collection(USERS_COLLECTION).doc(uid).delete();
    
    // Delete from Firebase Auth
    await auth.deleteUser(uid);
    
    logger.info('User deleted', { uid });
  } catch (error) {
    logger.error('Error deleting user:', error);
    throw error;
  }
};

export default {
  createUser,
  getUserById,
  getUserByUsername,
  updateUser,
  updateLastLogin,
  isUsernameTaken,
  updatePremiumStatus,
  updateUserPremiumStatus,
  deleteUser
}; 