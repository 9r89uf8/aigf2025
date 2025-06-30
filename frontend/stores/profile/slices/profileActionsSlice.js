/**
 * Profile Actions Slice
 * Handles profile-related API calls and business logic
 */
import { apiClient } from '../../../lib/api/client';
import toast from 'react-hot-toast';

export const createProfileActionsSlice = (set, get) => ({
  // Fetch user profile
  fetchProfile: async () => {
    try {
      set({ isLoadingProfile: true, profileError: null });
      const response = await apiClient.get('/auth/me');
      set({ 
        profile: response.data.user,
        isLoadingProfile: false 
      });
      return response.data.user;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to load profile';
      set({ 
        profileError: errorMessage,
        isLoadingProfile: false 
      });
      throw error;
    }
  },

  // Update user profile
  updateUserProfile: async (profileData) => {
    try {
      set({ isUpdatingProfile: true, profileError: null });
      const response = await apiClient.put('/auth/me', profileData);
      
      // Update local state
      set({ 
        profile: response.data.user,
        isUpdatingProfile: false 
      });
      
      toast.success('Profile updated successfully!');
      return response.data.user;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to update profile';
      set({ 
        profileError: errorMessage,
        isUpdatingProfile: false 
      });
      toast.error(errorMessage);
      throw error;
    }
  },

  // Upload avatar
  uploadAvatar: async (file, onProgress = null) => {
    try {
      set({ isUploadingAvatar: true, uploadError: null });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'avatar');

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };

      if (onProgress) {
        config.onUploadProgress = (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        };
      }

      const response = await apiClient.post('/media/upload', formData, config);
      
      // Update profile with new avatar URL
      if (response.data.url) {
        get().updateProfile({ avatarUrl: response.data.url });
      }
      
      set({ isUploadingAvatar: false });
      toast.success('Avatar uploaded successfully!');
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to upload avatar';
      set({ 
        uploadError: errorMessage,
        isUploadingAvatar: false 
      });
      toast.error(errorMessage);
      throw error;
    }
  },

  // Fetch usage statistics
  fetchUsageStats: async () => {
    try {
      set({ isLoadingStats: true, statsError: null });
      const response = await apiClient.get('/auth/usage');
      
      // The backend now returns the data in the correct format
      const formattedStats = {
        totalMessages: response.data.totalMessages || 0,
        messagesRemaining: response.data.messagesRemaining,
        resetTime: response.data.resetTime ? new Date(response.data.resetTime) : null,
        messagesByCharacter: response.data.messagesByCharacter || [],
        messageTypeBreakdown: response.data.messageTypeBreakdown || {
          text: 0,
          image: 0,
          audio: 0,
        },
        mostChattedCharacters: response.data.mostChattedCharacters || [],
      };
      
      set({ 
        usageStats: formattedStats,
        isLoadingStats: false 
      });
      return formattedStats;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to load usage statistics';
      set({ 
        statsError: errorMessage,
        isLoadingStats: false 
      });
      throw error;
    }
  },

  // Delete account
  deleteAccount: async (confirmationText) => {
    try {
      const response = await apiClient.delete('/auth/me', {
        data: { confirmation: confirmationText }
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to delete account';
      toast.error(errorMessage);
      throw error;
    }
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    try {
      const response = await apiClient.put('/auth/password', {
        currentPassword,
        newPassword
      });
      toast.success('Password changed successfully!');
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      toast.error(errorMessage);
      throw error;
    }
  },

  // Reset store
  resetProfile: () => set({
    profile: {
      displayName: '',
      username: '',
      bio: '',
      avatarUrl: '',
      email: '',
    },
    usageStats: {
      totalMessages: 0,
      messagesRemaining: null,
      resetTime: null,
      messagesByCharacter: [],
      messageTypeBreakdown: {
        text: 0,
        image: 0,
        audio: 0,
      },
      mostChattedCharacters: [],
    },
    isLoadingProfile: false,
    isLoadingStats: false,
    isUpdatingProfile: false,
    isUploadingAvatar: false,
    profileError: null,
    statsError: null,
    uploadError: null,
  }),
});