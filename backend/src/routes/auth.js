/**
 * Authentication routes
 * Handles user registration, login, and profile management
 */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { rateLimiters } from '../middleware/rateLimiter.js';
import { 
  createUser, 
  getUserById, 
  updateUser, 
  updateLastLogin,
  isUsernameTaken 
} from '../services/userService.js';
import { getAllUserUsage } from '../services/usageService.js';
import { getCharacterById } from '../services/characterService.js';
import { sanitizeUser } from '../models/User.js';
import { getFirebaseAuth } from '../config/firebase.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Register new user
 * POST /auth/register
 */
router.post('/register', [
  rateLimiters.auth,
  body('idToken').notEmpty().withMessage('ID token is required'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Display name must be less than 50 characters')
], asyncHandler(async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  const { idToken, username, displayName } = req.body;

  try {
    // Verify Firebase token
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email, email_verified, picture } = decodedToken;

    // Check if user already exists
    const existingUser = await getUserById(uid);
    if (existingUser) {
      throw new ApiError(400, 'User already registered');
    }

    // Create user in Firestore
    const userData = {
      email,
      username,
      displayName: displayName || username,
      photoURL: picture || '',
      emailVerified: email_verified || false
    };

    const newUser = await createUser(uid, userData);

    // Update last login
    await updateLastLogin(uid);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: sanitizeUser(newUser)
    });
  } catch (error) {
    if (error.code === 'auth/invalid-id-token') {
      throw new ApiError(401, 'Invalid authentication token');
    }
    throw error;
  }
}));

/**
 * Get current user profile
 * GET /auth/me
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await getUserById(req.user.uid);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json({
    success: true,
    user: sanitizeUser(user)
  });
}));

/**
 * Update user profile
 * PUT /auth/me
 */
router.put('/me', [
  authenticate,
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Display name must be less than 50 characters'),
  body('photoURL')
    .optional()
    .isURL()
    .withMessage('Photo URL must be a valid URL'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object')
], asyncHandler(async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  const { displayName, photoURL, preferences } = req.body;
  const updates = {};

  // Only include fields that were provided
  if (displayName !== undefined) updates.displayName = displayName;
  if (photoURL !== undefined) updates.photoURL = photoURL;
  if (preferences !== undefined) {
    // Merge with existing preferences
    const currentUser = await getUserById(req.user.uid);
    updates.preferences = { ...currentUser.preferences, ...preferences };
  }

  const updatedUser = await updateUser(req.user.uid, updates);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: sanitizeUser(updatedUser)
  });
}));

/**
 * Check username availability
 * GET /auth/check-username/:username
 */
router.get('/check-username/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;


  // Validate username format
  if (!username.match(/^[a-zA-Z0-9_]+$/)) {
    throw new ApiError(400, 'Invalid username format');
  }

  const isTaken = await isUsernameTaken(username);

  res.json({
    success: true,
    available: !isTaken
  });
}));

/**
 * Login existing user
 * POST /auth/login
 */
router.post('/login', [
  rateLimiters.auth,
  body('idToken').notEmpty().withMessage('ID token is required')
], asyncHandler(async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  const { idToken } = req.body;

  try {
    // Verify Firebase token
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid } = decodedToken;

    // Get user from database
    const user = await getUserById(uid);
    
    if (!user) {
      throw new ApiError(404, 'User not found. Please register first.');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Account has been deactivated');
    }

    // Update last login
    await updateLastLogin(uid);

    res.json({
      success: true,
      message: 'Login successful',
      user: sanitizeUser(user)
    });
  } catch (error) {
    if (error.code === 'auth/invalid-id-token') {
      throw new ApiError(401, 'Invalid authentication token');
    }
    throw error;
  }
}));

/**
 * Get user usage stats
 * GET /auth/usage
 */
router.get('/usage', authenticate, asyncHandler(async (req, res) => {
  const user = await getUserById(req.user.uid);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Get usage from Redis (real-time data)
  let redisUsage = {};
  try {
    console.log('🔍 USAGE DEBUG: Before getAllUserUsage call:', {
      userId: req.user.uid,
      userIdType: typeof req.user.uid,
      userIdLength: req.user.uid?.length
    });
    
    redisUsage = await getAllUserUsage(req.user.uid);
    
    console.log('🔍 USAGE DEBUG: Raw Redis data:', {
      userId: req.user.uid,
      redisUsage,
      characterCount: Object.keys(redisUsage).length,
      characters: Object.keys(redisUsage)
    });
    logger.debug('Usage fetched from Redis', { 
      userId: req.user.uid, 
      characterCount: Object.keys(redisUsage).length,
      characters: Object.keys(redisUsage)
    });
  } catch (redisError) {
    console.error('🚫 USAGE DEBUG: Redis error:', redisError);
    logger.error('Failed to fetch usage from Redis, returning empty usage:', redisError);
    // Return empty usage instead of failing the request
    redisUsage = {};
  }
  
  // Calculate total usage across all characters
  const totalUsage = {
    text: 0,
    audio: 0,
    image: 0
  };

  const formattedUsage = {};
  const messagesByCharacter = [];
  const characterUsageMap = new Map(); // To track usage for mostChattedCharacters

  // Transform Redis format to frontend format
  // Redis: {characterId: {textMessages: 2, audioMessages: 0, mediaMessages: 0}}
  // Frontend: {characterId: {text: 2, audio: 0, image: 0}}
  for (const [characterId, usage] of Object.entries(redisUsage)) {
    
    const textUsage = usage.textMessages || 0;
    const audioUsage = usage.audioMessages || 0;
    const imageUsage = usage.mediaMessages || 0; // Redis uses 'mediaMessages' for images
    
    totalUsage.text += textUsage;
    totalUsage.audio += audioUsage;
    totalUsage.image += imageUsage;

    formattedUsage[characterId] = {
      text: textUsage,
      audio: audioUsage,
      image: imageUsage,
      limits: user.isPremium ? null : {
        text: 30,
        audio: 5,
        image: 5
      },
      remaining: user.isPremium ? null : {
        text: Math.max(0, 30 - textUsage),
        audio: Math.max(0, 5 - audioUsage),
        image: Math.max(0, 5 - imageUsage)
      },
      // Include additional Redis metadata for debugging
      resetAt: usage.resetAt,
      lastMessageAt: usage.lastMessageAt
    };

    // Track total messages per character
    const totalCharacterMessages = textUsage + audioUsage + imageUsage;
    characterUsageMap.set(characterId, totalCharacterMessages);
  }

  // Fetch character details for each character the user has talked to
  const characterIds = Object.keys(redisUsage);
  const characterDetailsPromises = characterIds.map(async (characterId) => {
    try {
      const character = await getCharacterById(characterId);
      const totalMessages = characterUsageMap.get(characterId) || 0;
      const usage = formattedUsage[characterId];
      
      return {
        characterId,
        name: character?.name || 'Unknown Character',
        avatar: character?.avatar || null,
        count: totalMessages,
        // Add per-character usage limits and remaining
        usage: {
          text: usage.text,
          audio: usage.audio,
          image: usage.image
        },
        limits: user.isPremium ? null : {
          text: 30,
          audio: 5,
          image: 5
        },
        remaining: user.isPremium ? null : {
          text: Math.max(0, 30 - usage.text),
          audio: Math.max(0, 5 - usage.audio),
          image: Math.max(0, 5 - usage.image)
        }
      };
    } catch (error) {
      logger.error('Failed to fetch character details', { characterId, error });
      const usage = formattedUsage[characterId];
      // Return basic info if character fetch fails
      return {
        characterId,
        name: 'Unknown Character',
        avatar: null,
        count: characterUsageMap.get(characterId) || 0,
        usage: {
          text: usage?.text || 0,
          audio: usage?.audio || 0,
          image: usage?.image || 0
        },
        limits: user.isPremium ? null : {
          text: 30,
          audio: 5,
          image: 5
        },
        remaining: user.isPremium ? null : {
          text: Math.max(0, 30 - (usage?.text || 0)),
          audio: Math.max(0, 5 - (usage?.audio || 0)),
          image: Math.max(0, 5 - (usage?.image || 0))
        }
      };
    }
  });

  // Wait for all character details to be fetched
  const characterDetails = await Promise.all(characterDetailsPromises);
  
  // Sort by message count for messagesByCharacter
  characterDetails.sort((a, b) => b.count - a.count);
  
  // Assign to messagesByCharacter
  messagesByCharacter.push(...characterDetails);
  
  // Get top 3 most chatted characters
  const mostChattedCharacters = characterDetails.slice(0, 3).filter(char => char.count > 0);

  // Calculate total messages across all types
  const totalMessages = totalUsage.text + totalUsage.audio + totalUsage.image;

  const response = {
    success: true,
    usage: formattedUsage,
    isPremium: user.isPremium,
    premiumExpiresAt: user.premiumExpiresAt,
    // New fields for frontend
    totalMessages,
    messagesRemaining: user.isPremium ? null : Math.max(0, 30 - totalUsage.text),
    messagesByCharacter,
    messageTypeBreakdown: {
      text: totalUsage.text,
      image: totalUsage.image,
      audio: totalUsage.audio
    },
    mostChattedCharacters
  };

  
  res.json(response);
}));

/**
 * Delete user account
 * DELETE /auth/me
 */
router.delete('/me', authenticate, asyncHandler(async (req, res) => {
  const { uid } = req.user;

  // You might want to add additional confirmation here
  // For example, require password re-authentication

  logger.warn('User deletion requested', { uid });

  // This would typically trigger a cleanup process
  // For now, we'll just deactivate the account
  await updateUser(uid, { isActive: false });

  res.json({
    success: true,
    message: 'Account deactivation requested'
  });
}));


/**
 * Check and update email verification status
 * GET /auth/verify-email
 */
router.get('/verify-email', authenticate, asyncHandler(async (req, res) => {
  const { uid } = req.user;

  try {
    // Get the latest user data from Firebase Auth
    const auth = getFirebaseAuth();
    const userRecord = await auth.getUser(uid);
    
    // Check if email is verified in Firebase Auth
    const isEmailVerified = userRecord.emailVerified;
    
    // Get current user from your database
    const currentUser = await getUserById(uid);
    
    if (!currentUser) {
      throw new ApiError(404, 'User not found');
    }
    
    // Update database if verification status has changed
    if (currentUser.emailVerified !== isEmailVerified) {
      await updateUser(uid, { emailVerified: isEmailVerified });
      logger.info('Email verification status updated', { uid, emailVerified: isEmailVerified });
    }
    
    res.json({
      success: true,
      emailVerified: isEmailVerified,
      message: isEmailVerified 
        ? 'Email has been verified' 
        : 'Email is not yet verified'
    });
  } catch (error) {
    logger.error('Error checking email verification', { uid, error });
    throw new ApiError(500, 'Failed to check email verification status');
  }
}));

export default router; 