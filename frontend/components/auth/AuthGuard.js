'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/stores/authStore';

/**
 * AuthGuard component to protect routes
 * Redirects to login if user is not authenticated
 */
export default function AuthGuard({ children, requireVerified = false }) {
  const router = useRouter();
  const { user, loading, initialized } = useAuthStore();

  useEffect(() => {
    if (!loading && initialized) {
      if (!user) {
        // Redirect to login if not authenticated
        router.push('/login');
      } else if (requireVerified && !user.emailVerified) {
        // Redirect to verification page if email not verified
        router.push('/verify-email');
      }
    }
  }, [user, loading, initialized, requireVerified, router]);

  // Show loading state
  if (loading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!user || (requireVerified && !user.emailVerified)) {
    return null;
  }

  return children;
} 