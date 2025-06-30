/**
 * Upload middleware
 * Handles multipart/form-data uploads using Multer
 */
import multer from 'multer';
import { UPLOAD_CONFIG } from '../config/storage.js';
import { validateFile } from '../services/mediaService.js';
import { ApiError } from './errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Memory storage configuration
 * Files are temporarily stored in memory as Buffer objects
 */
const storage = multer.memoryStorage();

/**
 * File filter function
 * @param {Object} req - Express request
 * @param {Object} file - File object
 * @param {Function} cb - Callback
 */
const fileFilter = (req, file, cb) => {
  // Determine file type from fieldname or query param
  const fileType = req.query.type || 'image';
  
  // Validate file
  const validation = validateFile({
    mimetype: file.mimetype,
    size: file.size
  }, fileType);
  
  if (!validation.isValid) {
    logger.warn('File upload rejected', {
      filename: file.originalname,
      mimetype: file.mimetype,
      errors: validation.errors
    });
    
    return cb(new ApiError(400, validation.errors.join(', ')), false);
  }
  
  // Accept file
  cb(null, true);
};

/**
 * Create multer instance with configuration
 */
const createUploader = (options = {}) => {
  const {
    maxFileSize = UPLOAD_CONFIG.maxFileSize.image,
    maxFiles = 10,
    fileType = 'image'
  } = options;
  
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    }
  });
};

/**
 * Single image upload middleware
 */
export const uploadSingleImage = createUploader({
  maxFileSize: UPLOAD_CONFIG.maxFileSize.image,
  maxFiles: 1,
  fileType: 'image'
}).single('image');

/**
 * Multiple images upload middleware
 * @param {number} maxCount - Maximum number of images
 */
export const uploadMultipleImages = (maxCount = 10) => {
  return createUploader({
    maxFileSize: UPLOAD_CONFIG.maxFileSize.image,
    maxFiles: maxCount,
    fileType: 'image'
  }).array('images', maxCount);
};

/**
 * Character gallery upload middleware
 * Allows multiple images for character galleries
 */
export const uploadGalleryImages = createUploader({
  maxFileSize: UPLOAD_CONFIG.maxFileSize.image,
  maxFiles: 20,
  fileType: 'image'
}).array('gallery', 20);

/**
 * Audio file upload middleware
 */
export const uploadAudio = createUploader({
  maxFileSize: UPLOAD_CONFIG.maxFileSize.audio,
  maxFiles: 1,
  fileType: 'audio'
}).single('audio');

/**
 * Video file upload middleware
 */
export const uploadVideo = createUploader({
  maxFileSize: UPLOAD_CONFIG.maxFileSize.video,
  maxFiles: 1,
  fileType: 'video'
}).single('video');

/**
 * Mixed file upload middleware
 * Accepts different field names for different file types
 */
export const uploadMixed = createUploader({
  maxFileSize: Math.max(
    UPLOAD_CONFIG.maxFileSize.image,
    UPLOAD_CONFIG.maxFileSize.audio,
    UPLOAD_CONFIG.maxFileSize.video
  ),
  maxFiles: 10
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'audio', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

/**
 * Error handling middleware for multer errors
 * Should be used after upload middleware
 */
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer error:', error);
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          error: 'File size too large'
        });
        
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files uploaded'
        });
        
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected field name'
        });
        
      default:
        return res.status(400).json({
          success: false,
          error: error.message
        });
    }
  }
  
  // Pass to next error handler
  next(error);
};

/**
 * Validate uploaded files middleware
 * Additional validation after multer processing
 */
export const validateUploadedFiles = (req, res, next) => {
  // Check if files were uploaded
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      error: 'No files uploaded'
    });
  }
  
  // Get all uploaded files
  const files = [];
  
  if (req.file) {
    files.push(req.file);
  }
  
  if (req.files) {
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else {
      // Handle fields upload
      Object.values(req.files).forEach(fieldFiles => {
        files.push(...fieldFiles);
      });
    }
  }
  
  // Log upload info
  logger.info('Files uploaded', {
    count: files.length,
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
    types: [...new Set(files.map(f => f.mimetype))]
  });
  
  next();
};

/**
 * Clean up uploaded files from memory
 * Should be called after processing
 */
export const cleanupUploadedFiles = (req) => {
  // Clear file references to free memory
  if (req.file) {
    req.file.buffer = null;
  }
  
  if (req.files) {
    if (Array.isArray(req.files)) {
      req.files.forEach(file => {
        file.buffer = null;
      });
    } else {
      Object.values(req.files).forEach(fieldFiles => {
        fieldFiles.forEach(file => {
          file.buffer = null;
        });
      });
    }
  }
};

export default {
  uploadSingleImage,
  uploadMultipleImages,
  uploadGalleryImages,
  uploadAudio,
  uploadVideo,
  uploadMixed,
  handleUploadError,
  validateUploadedFiles,
  cleanupUploadedFiles
}; 