/**
 * Media routes
 * Handles file uploads and media management
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { redisRateLimiter } from '../middleware/redisRateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadGalleryImages,
  uploadAudio,
  handleUploadError,
  validateUploadedFiles,
  cleanupUploadedFiles
} from '../middleware/upload.js';
import {
  uploadFile,
  processAndUploadImage,
  deleteFile,
  generateSignedUrl,
  listFiles
} from '../services/mediaService.js';
import { STORAGE_BUCKETS, isStorageConfigured } from '../config/storage.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Check storage configuration
 * GET /api/media/status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const configured = isStorageConfigured();
  
  res.json({
    success: true,
    configured,
    buckets: configured ? STORAGE_BUCKETS : null,
    features: {
      imageProcessing: true,
      audioUpload: true,
      videoUpload: false, // Not yet implemented
      signedUrls: true
    }
  });
}));

/**
 * Upload single image
 * POST /api/media/upload/image
 */
router.post('/upload/image',
  authenticate,
  redisRateLimiter.uploads,
  uploadSingleImage,
  handleUploadError,
  validateUploadedFiles,
  asyncHandler(async (req, res) => {
    if (!isStorageConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Storage not configured'
      });
    }
    
    const file = req.file;
    const { folder = STORAGE_BUCKETS.folders.userContent } = req.body;
    
    try {
      // Process and upload image
      const result = await processAndUploadImage(file.buffer, {
        originalName: file.originalname,
        folder: `${folder}/${req.user.uid}`,
        generateThumbnail: true,
        sizes: ['small', 'medium', 'large'],
        keepOriginal: true,
        isPublic: true
      });
      
      // Clean up memory
      cleanupUploadedFiles(req);
      
      res.json({
        success: true,
        imageId: result.id,
        variants: result.variants,
        metadata: result.metadata
      });
      
    } catch (error) {
      cleanupUploadedFiles(req);
      throw error;
    }
  })
);

/**
 * Upload multiple images
 * POST /api/media/upload/images
 */
router.post('/upload/images',
  authenticate,
  redisRateLimiter.uploads,
  uploadMultipleImages(10),
  handleUploadError,
  validateUploadedFiles,
  asyncHandler(async (req, res) => {
    if (!isStorageConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Storage not configured'
      });
    }
    
    const files = req.files;
    const { folder = STORAGE_BUCKETS.folders.userContent } = req.body;
    
    try {
      const results = [];
      
      // Process each image
      for (const file of files) {
        const result = await processAndUploadImage(file.buffer, {
          originalName: file.originalname,
          folder: `${folder}/${req.user.uid}`,
          generateThumbnail: true,
          sizes: ['small', 'medium'],
          keepOriginal: false,
          isPublic: true
        });
        
        results.push({
          imageId: result.id,
          variants: result.variants,
          metadata: result.metadata
        });
      }
      
      // Clean up memory
      cleanupUploadedFiles(req);
      
      res.json({
        success: true,
        images: results,
        count: results.length
      });
      
    } catch (error) {
      cleanupUploadedFiles(req);
      throw error;
    }
  })
);

/**
 * Upload character gallery images (Admin)
 * POST /api/media/upload/gallery/:characterId
 */
router.post('/upload/gallery/:characterId',
  authenticate,
  asyncHandler(async (req, res, next) => {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    next();
  }),
  uploadGalleryImages,
  handleUploadError,
  validateUploadedFiles,
  asyncHandler(async (req, res) => {
    if (!isStorageConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Storage not configured'
      });
    }
    
    const { characterId } = req.params;
    const files = req.files;
    
    try {
      const results = [];
      
      // Process gallery images
      for (const file of files) {
        const result = await processAndUploadImage(file.buffer, {
          originalName: file.originalname,
          folder: `${STORAGE_BUCKETS.folders.characters}/${characterId}/gallery`,
          generateThumbnail: true,
          sizes: ['small', 'medium', 'large'],
          keepOriginal: true,
          isPublic: true
        });
        
        results.push({
          imageId: result.id,
          url: result.variants.large.publicUrl,
          thumbnailUrl: result.variants.thumbnail.publicUrl,
          metadata: result.metadata
        });
      }
      
      // Clean up memory
      cleanupUploadedFiles(req);
      
      // TODO: Update character gallery in database
      
      res.json({
        success: true,
        characterId,
        images: results,
        count: results.length
      });
      
    } catch (error) {
      cleanupUploadedFiles(req);
      throw error;
    }
  })
);

/**
 * Upload audio file
 * POST /api/media/upload/audio
 */
router.post('/upload/audio',
  authenticate,
  redisRateLimiter.uploads,
  uploadAudio,
  handleUploadError,
  validateUploadedFiles,
  asyncHandler(async (req, res) => {
    if (!isStorageConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Storage not configured'
      });
    }
    
    const file = req.file;
    const { folder = STORAGE_BUCKETS.folders.userContent } = req.body;
    
    try {
      // Upload audio file
      const result = await uploadFile(file.buffer, {
        originalName: file.originalname,
        mimeType: file.mimetype,
        folder: `${folder}/${req.user.uid}/audio`,
        isPublic: false, // Audio files are private
        metadata: {
          uploadedBy: req.user.uid,
          duration: req.body.duration || null
        }
      });
      
      // Generate signed URL for playback
      const signedUrl = await generateSignedUrl(result.filePath, 3600); // 1 hour
      
      // Clean up memory
      cleanupUploadedFiles(req);
      
      res.json({
        success: true,
        audioId: result.filePath,
        url: signedUrl,
        size: result.size,
        mimeType: result.mimeType
      });
      
    } catch (error) {
      cleanupUploadedFiles(req);
      throw error;
    }
  })
);

/**
 * Delete file
 * DELETE /api/media/delete
 */
router.delete('/delete',
  authenticate,
  asyncHandler(async (req, res) => {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path required'
      });
    }
    
    // Verify user owns the file (check if path contains user ID)
    if (!filePath.includes(req.user.uid) && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to delete this file'
      });
    }
    
    try {
      await deleteFile(filePath);
      
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
      
    } catch (error) {
      if (error.code === 404) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      throw error;
    }
  })
);

/**
 * Generate signed URL for private file
 * POST /api/media/signed-url
 */
router.post('/signed-url',
  authenticate,
  asyncHandler(async (req, res) => {
    const { filePath, expiresIn = 3600 } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path required'
      });
    }
    
    // Verify user has access to the file
    if (!filePath.includes(req.user.uid) && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to access this file'
      });
    }
    
    try {
      const signedUrl = await generateSignedUrl(filePath, expiresIn);
      
      res.json({
        success: true,
        url: signedUrl,
        expiresIn
      });
      
    } catch (error) {
      if (error.code === 404) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      throw error;
    }
  })
);

/**
 * List user files
 * GET /api/media/list
 */
router.get('/list',
  authenticate,
  asyncHandler(async (req, res) => {
    const { folder = STORAGE_BUCKETS.folders.userContent, limit = 50, pageToken } = req.query;
    
    if (!isStorageConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Storage not configured'
      });
    }
    
    try {
      const userFolder = `${folder}/${req.user.uid}`;
      const result = await listFiles(userFolder, {
        limit: parseInt(limit),
        pageToken
      });
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      throw error;
    }
  })
);

/**
 * Get upload limits and configuration
 * GET /api/media/limits
 */
router.get('/limits', authenticate, (req, res) => {
  const { UPLOAD_CONFIG } = require('../config/storage.js');
  
  res.json({
    success: true,
    limits: {
      image: {
        maxSize: UPLOAD_CONFIG.maxFileSize.image,
        maxSizeMB: UPLOAD_CONFIG.maxFileSize.image / 1024 / 1024,
        allowedTypes: UPLOAD_CONFIG.allowedMimeTypes.image
      },
      audio: {
        maxSize: UPLOAD_CONFIG.maxFileSize.audio,
        maxSizeMB: UPLOAD_CONFIG.maxFileSize.audio / 1024 / 1024,
        allowedTypes: UPLOAD_CONFIG.allowedMimeTypes.audio
      },
      video: {
        maxSize: UPLOAD_CONFIG.maxFileSize.video,
        maxSizeMB: UPLOAD_CONFIG.maxFileSize.video / 1024 / 1024,
        allowedTypes: UPLOAD_CONFIG.allowedMimeTypes.video
      }
    },
    processing: {
      imageFormats: ['webp'],
      imageSizes: ['thumbnail', 'small', 'medium', 'large', 'original']
    }
  });
});

export default router; 