/**
 * Main Profile Store
 * Combines all profile-related slices into a single store
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createProfileDataSlice } from './slices/profileDataSlice';
import { createUsageStatsSlice } from './slices/usageStatsSlice';
import { createProfileActionsSlice } from './slices/profileActionsSlice';

const useProfileStore = create(
  devtools(
    (set, get, api) => ({
      // Combine all slices
      ...createProfileDataSlice(set, get, api),
      ...createUsageStatsSlice(set, get, api),
      ...createProfileActionsSlice(set, get, api),
      
      // Additional helper to clear all errors
      clearErrors: () => {
        get().clearProfileErrors();
        get().clearStatsError();
      },
      
      // Alias for resetProfile
      reset: () => get().resetProfile(),
    }),
    {
      name: 'profile-store',
    }
  )
);

export default useProfileStore;