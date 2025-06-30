'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import useProfileStore from '@/stores/profileStore';

const AvatarUpload = ({ currentAvatarUrl, onAvatarUpdate }) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  
  const { isUploadingAvatar, uploadAvatar, updateUserProfile } = useProfileStore();

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const validateAvatarFile = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!file) {
      return { valid: false, error: 'No file selected' };
    }
    
    if (!allowedTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' 
      };
    }
    
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: 'File too large. Maximum size is 5MB.' 
      };
    }
    
    return { valid: true };
  };

  const handleFile = async (file) => {
    setError('');
    
    // Validate file
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload file
    try {
      setUploadProgress(0);

      const response = await uploadAvatar(file, (progress) => {
        setUploadProgress(progress);
      });

      if (response.url) {
        onAvatarUpdate(response.url);
        setPreview(null);
        setUploadProgress(0);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload avatar');
      setPreview(null);
      setUploadProgress(0);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeAvatar = async () => {
    try {
      await updateUserProfile({ avatarUrl: '' });
      onAvatarUpdate('');
    } catch (error) {
      console.error('Error removing avatar:', error);
      setError('Failed to remove avatar');
    }
  };

  const displayUrl = preview || currentAvatarUrl;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
        {/* Avatar Preview */}
        <div className="flex-shrink-0">
          {displayUrl ? (
            <div className="relative">
              <Image
                src={displayUrl}
                alt="Avatar"
                width={128}
                height={128}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover"
              />
              {isUploadingAvatar && uploadProgress > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                  <div className="text-white text-sm font-medium">{uploadProgress}%</div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-200 flex items-center justify-center">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1 w-full sm:w-auto">
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <svg
              className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            
            <p className="mt-2 text-sm text-gray-600">
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={isUploadingAvatar}
                className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline disabled:opacity-50"
              >
                Upload a file
              </button>
              <span className="hidden sm:inline">{' '}or drag and drop</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              PNG, JPG, GIF or WebP up to 5MB
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isUploadingAvatar}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Change Avatar
            </button>
            {currentAvatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={isUploadingAvatar}
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;