/**
 * Character routes
 * Handles character management and gallery operations
 */
import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticate, optionalAuth, requireAdmin, requirePremium } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { rateLimiters } from '../middleware/rateLimiter.js';
import {
  createCharacter,
  getCharacterById,
  getAllCharacters,
  updateCharacter,
  updateCharacterStats,
  addGalleryItem,
  removeGalleryItem,
  getCharacterGallery,
  incrementGalleryViews,
  deleteCharacter
} from '../services/characterService.js';
import { canSendMessage } from '../services/usageService.js';
import { sanitizeCharacter, personalityTraits } from '../models/Character.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Get character personality traits
 * GET /characters/traits
 */
router.get('/traits', (req, res) => {
  res.json({
    success: true,
    traits: personalityTraits
  });
});

/**
 * Get all characters
 * GET /characters
 */
router.get('/', [
  optionalAuth,
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('sortBy').optional().isIn(['popularity', 'name', 'createdAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('tags').optional().isArray(),
  query('isPremiumOnly').optional().isBoolean().toBoolean(),
  query('search').optional().trim()
], asyncHandler(async (req, res) => {


  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  const options = {
    limit: req.query.limit || 50,
    offset: req.query.offset || 0,
    sortBy: req.query.sortBy || 'popularity',
    sortOrder: req.query.sortOrder || 'desc',
    tags: req.query.tags || [],
    isPremiumOnly: req.query.isPremiumOnly,
    searchQuery: req.query.search || ''
  };

  const result = await getAllCharacters(options);
  
  // Sanitize characters based on user premium status
  const isPremium = req.user?.isPremium || false;
  result.characters = result.characters.map(character => 
    sanitizeCharacter(character, isPremium)
  );

  res.json({
    success: true,
    ...result
  });
}));

/**
 * Get character by ID
 * GET /characters/:id
 */
router.get('/:id', [
  optionalAuth,
  param('id').notEmpty()
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const character = await getCharacterById(id);
  
  if (!character) {
    throw new ApiError(404, 'Character not found');
  }
  
  // Sanitize based on user premium status
  const isPremium = req.user?.isPremium || false;
  const sanitized = sanitizeCharacter(character, isPremium);
  
  // Add usage info if user is authenticated
  if (req.user) {
    const usage = await canSendMessage(req.user.uid, id, 'text', isPremium);
    sanitized.userUsage = usage;
  }
  
  res.json({
    success: true,
    character: sanitized
  });
}));

/**
 * Create new character (Admin only)
 * POST /characters
 */
router.post('/', [
  authenticate,
  requireAdmin,
  body('name').trim().isLength({ min: 2, max: 50 }),
  body('description').trim().isLength({ min: 10, max: 200 }),
  body('bio').trim().isLength({ min: 20, max: 1000 }),
  body('avatar').isURL(),
  body('personality.traits').isArray().custom(traits => {
    const invalidTraits = traits.filter(trait => !personalityTraits.includes(trait));
    if (invalidTraits.length > 0) {
      throw new Error(`Invalid traits: ${invalidTraits.join(', ')}`);
    }
    return true;
  }),
  body('tags').optional().isArray(),
  body('isPremiumOnly').optional().isBoolean()
], asyncHandler(async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  const character = await createCharacter(req.body);

  res.status(201).json({
    success: true,
    message: 'Character created successfully',
    character: sanitizeCharacter(character, true)
  });
}));

/**
 * Update character (Admin only)
 * PUT /characters/:id
 */
router.put('/:id', [
  authenticate,
  requireAdmin,
  param('id').notEmpty(),
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('description').optional().trim().isLength({ min: 10, max: 200 }),
  body('bio').optional().trim().isLength({ min: 20, max: 1000 }),
  body('avatar').optional().isURL(),
  body('personality.traits').optional().isArray(),
  body('tags').optional().isArray(),
  body('isPremiumOnly').optional().isBoolean(),
  body('isActive').optional().isBoolean()
], asyncHandler(async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  const { id } = req.params;
  const character = await updateCharacter(id, req.body);

  res.json({
    success: true,
    message: 'Character updated successfully',
    character: sanitizeCharacter(character, true)
  });
}));

/**
 * Delete character (Admin only)
 * DELETE /characters/:id
 */
router.delete('/:id', [
  authenticate,
  requireAdmin,
  param('id').notEmpty()
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await deleteCharacter(id);

  res.json({
    success: true,
    message: 'Character deleted successfully'
  });
}));

/**
 * Get character gallery
 * GET /characters/:id/gallery
 */
router.get('/:id/gallery', [
  optionalAuth,
  param('id').notEmpty()
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isPremium = req.user?.isPremium || false;
  
  const result = await getCharacterGallery(id, isPremium);

  res.json({
    success: true,
    ...result
  });
}));

/**
 * Add gallery item (Admin only)
 * POST /characters/:id/gallery
 */
router.post('/:id/gallery', [
  authenticate,
  requireAdmin,
  rateLimiters.upload,
  param('id').notEmpty(),
  body('type').isIn(['image', 'video', 'audio']),
  body('url').isURL(),
  body('thumbnailUrl').optional().isURL(),
  body('caption').optional().trim().isLength({ max: 200 }),
  body('tags').optional().isArray(),
  body('isPremiumOnly').optional().isBoolean()
], asyncHandler(async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  const { id } = req.params;
  const character = await addGalleryItem(id, req.body);

  res.json({
    success: true,
    message: 'Gallery item added successfully',
    character: sanitizeCharacter(character, true)
  });
}));

/**
 * Remove gallery item (Admin only)
 * DELETE /characters/:id/gallery/:itemId
 */
router.delete('/:id/gallery/:itemId', [
  authenticate,
  requireAdmin,
  param('id').notEmpty(),
  param('itemId').notEmpty()
], asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  
  const character = await removeGalleryItem(id, itemId);

  res.json({
    success: true,
    message: 'Gallery item removed successfully',
    character: sanitizeCharacter(character, true)
  });
}));

/**
 * Track gallery item view
 * POST /characters/:id/gallery/:itemId/view
 */
router.post('/:id/gallery/:itemId/view', [
  optionalAuth,
  param('id').notEmpty(),
  param('itemId').notEmpty()
], asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  
  // Check if user has access (premium items require premium status)
  if (req.user) {
    const character = await getCharacterById(id);
    if (character) {
      const item = (character.gallery || []).find(g => g.id === itemId);
      if (item && item.isPremiumOnly && !req.user.isPremium) {
        throw new ApiError(403, 'Premium subscription required to view this content');
      }
    }
  }
  
  await incrementGalleryViews(id, itemId);

  res.json({
    success: true,
    message: 'View tracked'
  });
}));

/**
 * Update character stats (internal use)
 * This would typically be called by other services
 */
export const updateCharacterStatsInternal = async (characterId, updates) => {
  try {
    await updateCharacterStats(characterId, updates);
  } catch (error) {
    logger.error('Failed to update character stats:', error);
  }
};

export default router; 