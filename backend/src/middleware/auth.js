/**
 * Authentication middleware
 * Verifies Firebase ID tokens and manages user sessions
 */
import { verifyIdToken } from '../config/firebase.js';
import { ApiError, asyncHandler } from './errorHandler.js';
import { getUserById } from '../services/userService.js';
import logger from '../utils/logger.js';

/**
 * Verify Firebase token and attach user to request
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  let token;
  
  // Extract token from Authorization header or query param
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    throw new ApiError(401, 'No authentication token provided');
  }
  
  try {
    // Verify Firebase token
    const decodedToken = await verifyIdToken(token);
    
    // Get user from database
    const user = await getUserById(decodedToken.uid);
    
    if (!user) {
      throw new ApiError(401, 'User not found');
    }
    
    // Attach user to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      ...user
    };
    
    logger.debug('User authenticated', { uid: req.user.uid });
    next();
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      throw new ApiError(401, 'Token has expired');
    } else if (error.code === 'auth/argument-error') {
      throw new ApiError(401, 'Invalid token format');
    } else if (error.code === 'auth/id-token-revoked') {
      throw new ApiError(401, 'Token has been revoked');
    }
    
    logger.error('Authentication failed:', error);
    throw new ApiError(401, 'Authentication failed');
  }
});

/**
 * Optional authentication - doesn't fail if no token
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return next();
  }
  
  try {
    const decodedToken = await verifyIdToken(token);
    const user = await getUserById(decodedToken.uid);
    
    if (user) {
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        ...user
      };
    }
  } catch (error) {
    logger.debug('Optional auth failed, continuing without user', { error: error.message });
  }
  
  next();
});

/**
 * Check if user is premium
 * Must be used after authenticate middleware
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const requirePremium = (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  
  if (!req.user.isPremium) {
    throw new ApiError(403, 'Premium subscription required');
  }
  
  // Check if premium has expired
  if (req.user.premiumExpiresAt && new Date(req.user.premiumExpiresAt) < new Date()) {
    throw new ApiError(403, 'Premium subscription has expired');
  }
  
  next();
};

/**
 * Check if user has admin role
 * Must be used after authenticate middleware
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  
  if (!req.user.roles || !req.user.roles.includes('admin')) {
    throw new ApiError(403, 'Admin access required');
  }
  
  next();
};

export default {
  authenticate,
  optionalAuth,
  requirePremium,
  requireAdmin
}; 