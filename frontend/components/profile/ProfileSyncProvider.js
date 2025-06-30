'use client';

import { useEffect } from 'react';
import useAuthStore from '@/stores/authStore';
import useProfileStore from '@/stores/profileStore';

/**
 * ProfileSyncProvider ensures profile data is synchronized between auth and profile stores
 * This component should wrap pages that need profile data synchronization
 */
const ProfileSyncProvider = ({ children }) => {
  const { user } = useAuthStore();
  const { profile, setProfile } = useProfileStore();

  useEffect(() => {
    // Sync profile data when user changes
    if (user && (!profile || profile.email !== user.email)) {
      setProfile({
        displayName: user.displayName || '',
        username: user.username || '',
        bio: user.bio || '',
        avatarUrl: user.photoURL || '',
        email: user.email || '',
      });
    }
  }, [user, profile, setProfile]);

  // Listen for storage events to sync across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'auth-storage' && e.newValue) {
        try {
          const newAuthState = JSON.parse(e.newValue);
          if (newAuthState?.state?.user) {
            const updatedUser = newAuthState.state.user;
            setProfile({
              displayName: updatedUser.displayName || '',
              username: updatedUser.username || '',
              bio: updatedUser.bio || '',
              avatarUrl: updatedUser.photoURL || '',
              email: updatedUser.email || '',
            });
          }
        } catch (error) {
          console.error('Error syncing profile from storage:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [setProfile]);

  return children;
};

export default ProfileSyncProvider;