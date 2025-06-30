/**
 * Media Service
 * Handles file uploads, image processing, and storage
 */
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { 
  getStorageClient, 
  STORAGE_BUCKETS, 
  UPLOAD_CONFIG,
  getPublicUrl,
  getSignedUrl 
} from '../config/storage.js';
import { isStorageConfigured } from '../config/storage.js';
import cacheService from './cacheService.js';
import logger from '../utils/logger.js';

/**
 * Upload file to storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result
 */
export const uploadFile = async (fileBuffer, options) => {
  const {
    originalName,
    mimeType,
    folder,
    isPublic = true,
    metadata = {}
  } = options;
  
  try {
    const storage = getStorageClient();
    if (!storage) {
      throw new Error('Storage not configured');
    }
    
    // Generate unique filename
    const fileName = UPLOAD_CONFIG.fileNaming.generateFileName(originalName);
    const filePath = folder ? `${folder}/${fileName}` : fileName;
    
    // Get bucket
    const bucket = storage.bucket(STORAGE_BUCKETS.media);
    const file = bucket.file(filePath);
    
    // Upload file
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        ...metadata
      },
      public: isPublic,
      resumable: false
    });
    
    // Set cache control
    if (isPublic) {
      await file.setMetadata({
        cacheControl: 'public, max-age=31536000'
      });
    }
    
    const publicUrl = getPublicUrl(filePath);
    
    logger.info('File uploaded', {
      fileName,
      size: fileBuffer.length,
      mimeType
    });
    
    return {
      fileName,
      filePath,
      publicUrl,
      size: fileBuffer.length,
      mimeType
    };
    
  } catch (error) {
    logger.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Process and upload image with multiple sizes
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processed images info
 */
export const processAndUploadImage = async (imageBuffer, options) => {
  const {
    originalName,
    folder,
    generateThumbnail = true,
    sizes = ['small', 'medium', 'large'],
    keepOriginal = true,
    isPublic = true
  } = options;
  
  try {
    const results = {};
    const baseFileName = originalName.split('.')[0];
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    
    // Process thumbnail if requested
    if (generateThumbnail) {
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(
          UPLOAD_CONFIG.imageProcessing.thumbnail.width,
          UPLOAD_CONFIG.imageProcessing.thumbnail.height,
          { fit: UPLOAD_CONFIG.imageProcessing.thumbnail.fit }
        )
        .webp({ quality: UPLOAD_CONFIG.imageProcessing.thumbnail.quality })
        .toBuffer();
      
      const thumbnailResult = await uploadFile(thumbnailBuffer, {
        originalName: `${baseFileName}-thumb.webp`,
        mimeType: 'image/webp',
        folder,
        isPublic,
        metadata: { 
          originalName,
          variant: 'thumbnail'
        }
      });
      
      results.thumbnail = thumbnailResult;
    }
    
    // Process different sizes
    for (const sizeName of sizes) {
      const sizeConfig = UPLOAD_CONFIG.imageProcessing.sizes[sizeName];
      if (!sizeConfig) continue;
      
      // Prepare Sharp instance
      let sharpInstance = sharp(imageBuffer);
      
      // Resize if dimensions specified
      if (sizeConfig.width || sizeConfig.height) {
        sharpInstance = sharpInstance.resize(sizeConfig.width, sizeConfig.height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Convert to WebP
      const processedBuffer = await sharpInstance
        .webp({ quality: sizeConfig.quality })
        .toBuffer();
      
      // Upload processed image
      const uploadResult = await uploadFile(processedBuffer, {
        originalName: `${baseFileName}-${sizeName}.webp`,
        mimeType: 'image/webp',
        folder,
        isPublic,
        metadata: {
          originalName,
          variant: sizeName,
          originalWidth: metadata.width,
          originalHeight: metadata.height
        }
      });
      
      results[sizeName] = uploadResult;
    }
    
    // Keep original if requested
    if (keepOriginal) {
      const originalResult = await uploadFile(imageBuffer, {
        originalName,
        mimeType: `image/${metadata.format}`,
        folder,
        isPublic,
        metadata: {
          variant: 'original',
          width: metadata.width,
          height: metadata.height
        }
      });
      
      results.original = originalResult;
    }
    
    // Cache the results
    const cacheKey = `media:${uuidv4()}`;
    await cacheService.set(cacheKey, results, 3600); // Cache for 1 hour
    
    return {
      id: cacheKey,
      variants: results,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size
      }
    };
    
  } catch (error) {
    logger.error('Error processing image:', error);
    throw error;
  }
};

/**
 * Delete file from storage
 * @param {string} filePath - File path in bucket
 * @returns {Promise<void>}
 */
export const deleteFile = async (filePath) => {
  try {
    const storage = getStorageClient();
    if (!storage) {
      throw new Error('Storage not configured');
    }
    
    const bucket = storage.bucket(STORAGE_BUCKETS.media);
    const file = bucket.file(filePath);
    
    await file.delete();
    
    logger.info('File deleted', { filePath });
    
  } catch (error) {
    logger.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * Delete multiple files
 * @param {Array<string>} filePaths - Array of file paths
 * @returns {Promise<void>}
 */
export const deleteMultipleFiles = async (filePaths) => {
  try {
    const deletePromises = filePaths.map(filePath => deleteFile(filePath));
    await Promise.all(deletePromises);
    
    logger.info('Multiple files deleted', { count: filePaths.length });
    
  } catch (error) {
    logger.error('Error deleting multiple files:', error);
    throw error;
  }
};

/**
 * Validate file before upload
 * @param {Object} file - File object with mimetype and size
 * @param {string} fileType - Type of file (image, audio, video)
 * @returns {Object} Validation result
 */
export const validateFile = (file, fileType) => {
  const result = {
    isValid: true,
    errors: []
  };
  
  // Check file size
  const maxSize = UPLOAD_CONFIG.maxFileSize[fileType];
  if (maxSize && file.size > maxSize) {
    result.isValid = false;
    result.errors.push(`File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)`);
  }
  
  // Check MIME type
  const allowedMimeTypes = UPLOAD_CONFIG.allowedMimeTypes[fileType];
  if (allowedMimeTypes && !allowedMimeTypes.includes(file.mimetype)) {
    result.isValid = false;
    result.errors.push(`File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`);
  }
  
  return result;
};

/**
 * Generate temporary signed URL for private file
 * @param {string} filePath - File path in bucket
 * @param {number} expiresIn - Expiration in seconds
 * @returns {Promise<string>} Signed URL
 */
export const generateSignedUrl = async (filePath, expiresIn = 3600) => {
  try {
    return await getSignedUrl(STORAGE_BUCKETS.media, filePath, expiresIn);
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    throw error;
  }
};

/**
 * Copy file within storage
 * @param {string} sourcePath - Source file path
 * @param {string} destinationPath - Destination file path
 * @returns {Promise<string>} New file URL
 */
export const copyFile = async (sourcePath, destinationPath) => {
  try {
    const storage = getStorageClient();
    if (!storage) {
      throw new Error('Storage not configured');
    }
    
    const bucket = storage.bucket(STORAGE_BUCKETS.media);
    const sourceFile = bucket.file(sourcePath);
    const destinationFile = bucket.file(destinationPath);
    
    await sourceFile.copy(destinationFile);
    
    const publicUrl = getPublicUrl(destinationPath);
    
    logger.info('File copied', { sourcePath, destinationPath });
    
    return publicUrl;
    
  } catch (error) {
    logger.error('Error copying file:', error);
    throw error;
  }
};

/**
 * Get all files in a folder
 * @param {string} folderPath - Folder path
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of files
 */
export const listFiles = async (folderPath, options = {}) => {
  const { limit = 100, pageToken } = options;
  
  try {
    const storage = getStorageClient();
    if (!storage) {
      throw new Error('Storage not configured');
    }
    
    const bucket = storage.bucket(STORAGE_BUCKETS.media);
    
    const [files, nextQuery] = await bucket.getFiles({
      prefix: folderPath,
      maxResults: limit,
      pageToken
    });
    
    const fileList = files.map(file => ({
      name: file.name,
      size: parseInt(file.metadata.size),
      contentType: file.metadata.contentType,
      created: file.metadata.timeCreated,
      updated: file.metadata.updated,
      publicUrl: getPublicUrl(file.name)
    }));
    
    return {
      files: fileList,
      nextPageToken: nextQuery?.pageToken
    };
    
  } catch (error) {
    logger.error('Error listing files:', error);
    throw error;
  }
};

/**
 * Clean up temporary files older than specified age
 * @param {number} maxAgeHours - Maximum age in hours
 * @returns {Promise<number>} Number of files deleted
 */
export const cleanupTempFiles = async (maxAgeHours = 24) => {
  try {
    const storage = getStorageClient();
    if (!storage) {
      throw new Error('Storage not configured');
    }
    
    const bucket = storage.bucket(STORAGE_BUCKETS.media);
    const tempFolder = STORAGE_BUCKETS.folders.temp;
    
    const [files] = await bucket.getFiles({
      prefix: tempFolder
    });
    
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
    
    let deletedCount = 0;
    
    for (const file of files) {
      const created = new Date(file.metadata.timeCreated);
      if (created < cutoffTime) {
        await file.delete();
        deletedCount++;
      }
    }
    
    logger.info('Temp files cleaned up', { deletedCount });
    
    return deletedCount;
    
  } catch (error) {
    logger.error('Error cleaning up temp files:', error);
    throw error;
  }
};

export default {
  uploadFile,
  processAndUploadImage,
  deleteFile,
  deleteMultipleFiles,
  validateFile,
  generateSignedUrl,
  copyFile,
  listFiles,
  cleanupTempFiles
}; 