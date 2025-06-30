/**
 * Profile Data Slice
 * Manages user profile information
 */
export const createProfileDataSlice = (set, get) => ({
  // Profile data
  profile: {
    displayName: '',
    username: '',
    bio: '',
    avatarUrl: '',
    email: '',
  },
  
  // Loading states
  isLoadingProfile: false,
  isUpdatingProfile: false,
  isUploadingAvatar: false,
  
  // Error states
  profileError: null,
  uploadError: null,
  
  // Actions
  setProfile: (profile) => set({ profile }),
  
  updateProfile: (updates) => set((state) => ({
    profile: { ...state.profile, ...updates }
  })),
  
  // Loading state setters
  setLoadingProfile: (isLoading) => set({ isLoadingProfile: isLoading }),
  setUpdatingProfile: (isUpdating) => set({ isUpdatingProfile: isUpdating }),
  setUploadingAvatar: (isUploading) => set({ isUploadingAvatar: isUploading }),
  
  // Error setters
  setProfileError: (error) => set({ profileError: error }),
  setUploadError: (error) => set({ uploadError: error }),
  
  // Clear profile errors
  clearProfileErrors: () => set({
    profileError: null,
    uploadError: null,
  }),
});