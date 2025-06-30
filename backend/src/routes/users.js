/**
 * User routes
 * Protected routes for user-related operations
 */
import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { 
  getUserById, 
  getUserByUsername,
  updatePremiumStatus 
} from '../services/userService.js';
import { sanitizeUser } from '../models/User.js';

const router = Router();

/**
 * Get user by ID (Admin only)
 * GET /users/:uid
 */
router.get('/:uid', [authenticate, requireAdmin], asyncHandler(async (req, res) => {
  const { uid } = req.params;
  
  const user = await getUserById(uid);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  res.json({
    success: true,
    user
  });
}));

/**
 * Get user by username (Public)
 * GET /users/username/:username
 */
router.get('/username/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;
  
  const user = await getUserByUsername(username);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Return sanitized user data for public access
  res.json({
    success: true,
    user: sanitizeUser(user)
  });
}));

/**
 * Update user premium status (Admin only)
 * PUT /users/:uid/premium
 */
router.put('/:uid/premium', [authenticate, requireAdmin], asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const { isPremium, durationDays = 15 } = req.body;
  
  // Calculate expiration date if setting premium
  let expiresAt = null;
  if (isPremium) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
  }
  
  const updatedUser = await updatePremiumStatus(uid, isPremium, expiresAt);
  
  res.json({
    success: true,
    message: `Premium status ${isPremium ? 'activated' : 'deactivated'}`,
    user: updatedUser
  });
}));

export default router; 