/**
 * Storage configuration
 * Manages Google Cloud Storage for media files
 */
import { Storage } from '@google-cloud/storage';
import { config } from './environment.js';
import logger from '../utils/logger.js';

let storageClient = null;

/**
 * Initialize storage client
 * @returns {Storage} Storage client instance
 */
export const initializeStorage = () => {
  try {
    // Use Firebase Admin SDK credentials if available
    const firebaseConfig = config.firebase;
    
    if (!firebaseConfig.projectId) {
      logger.warn('Firebase project ID not configured for storage');
      return null;
    }
    
    // Initialize storage client
    storageClient = new Storage({
      projectId: firebaseConfig.projectId,
      keyFilename: firebaseConfig.serviceAccountPath || undefined
    });
    
    logger.info('Storage client initialized');
    return storageClient;
  } catch (error) {
    logger.error('Failed to initialize storage:', error);
    return null;
  }
};

/**
 * Get storage client
 * @returns {Storage} Storage client instance
 */
export const getStorageClient = () => {
  if (!storageClient) {
    storageClient = initializeStorage();
  }
  return storageClient;
};

/**
 * Storage bucket names
 */
export const STORAGE_BUCKETS = {
  // Main bucket for all media
  media: process.env.STORAGE_BUCKET || `${config.firebase.projectId}-media`,
  
  // Subfolder structure
  folders: {
    characters: 'characters',
    userContent: 'user-content',
    temp: 'temp'
  }
};

/**
 * File upload configuration
 */
export const UPLOAD_CONFIG = {
  // Maximum file sizes (in bytes)
  maxFileSize: {
    image: 10 * 1024 * 1024, // 10MB
    audio: 50 * 1024 * 1024, // 50MB
    video: 100 * 1024 * 1024 // 100MB
  },
  
  // Allowed MIME types
  allowedMimeTypes: {
    image: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    audio: [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/webm'
    ],
    video: [
      'video/mp4',
      'video/webm',
      'video/ogg'
    ]
  },
  
  // Image processing settings
  imageProcessing: {
    // Thumbnail generation
    thumbnail: {
      width: 150,
      height: 150,
      fit: 'cover',
      quality: 80
    },
    
    // Standard sizes
    sizes: {
      small: { width: 400, height: 400, quality: 85 },
      medium: { width: 800, height: 800, quality: 85 },
      large: { width: 1200, height: 1200, quality: 90 },
      original: { quality: 95 } // Keep original dimensions
    },
    
    // Output format
    format: 'webp', // Convert to WebP for better compression
    
    // Maximum dimensions
    maxWidth: 2000,
    maxHeight: 2000
  },
  
  // File naming
  fileNaming: {
    // Use timestamp + random string
    generateFileName: (originalName) => {
      const ext = originalName.split('.').pop();
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      return `${timestamp}-${random}.${ext}`;
    }
  }
};

/**
 * CDN configuration
 */
export const CDN_CONFIG = {
  // Base URL for serving files
  baseUrl: process.env.CDN_BASE_URL || `https://storage.googleapis.com/${STORAGE_BUCKETS.media}`,
  
  // Cache control headers
  cacheControl: {
    public: 'public, max-age=31536000', // 1 year for public files
    private: 'private, max-age=3600' // 1 hour for private files
  }
};

/**
 * Get public URL for a file
 * @param {string} filePath - File path in bucket
 * @returns {string} Public URL
 */
export const getPublicUrl = (filePath) => {
  return `${CDN_CONFIG.baseUrl}/${filePath}`;
};

/**
 * Get signed URL for temporary access
 * @param {string} bucketName - Bucket name
 * @param {string} fileName - File name
 * @param {number} expiresIn - Expiration in seconds (default: 1 hour)
 * @returns {Promise<string>} Signed URL
 */
export const getSignedUrl = async (bucketName, fileName, expiresIn = 3600) => {
  try {
    const storage = getStorageClient();
    if (!storage) {
      throw new Error('Storage not configured');
    }
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + (expiresIn * 1000)
    });
    
    return url;
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    throw error;
  }
};

/**
 * Check if storage is configured
 * @returns {boolean} True if configured
 */
export const isStorageConfigured = () => {
  return !!(
    config.firebase.projectId &&
    (config.firebase.serviceAccountPath || process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
};

/**
 * Get file metadata
 * @param {string} bucketName - Bucket name
 * @param {string} fileName - File name
 * @returns {Promise<Object>} File metadata
 */
export const getFileMetadata = async (bucketName, fileName) => {
  try {
    const storage = getStorageClient();
    if (!storage) {
      throw new Error('Storage not configured');
    }
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    const [metadata] = await file.getMetadata();
    
    return {
      name: metadata.name,
      size: parseInt(metadata.size),
      contentType: metadata.contentType,
      created: metadata.timeCreated,
      updated: metadata.updated,
      md5Hash: metadata.md5Hash,
      publicUrl: metadata.mediaLink
    };
  } catch (error) {
    logger.error('Error getting file metadata:', error);
    throw error;
  }
};

export default {
  initializeStorage,
  getStorageClient,
  isStorageConfigured,
  STORAGE_BUCKETS,
  UPLOAD_CONFIG,
  CDN_CONFIG,
  getPublicUrl,
  getSignedUrl,
  getFileMetadata
}; 