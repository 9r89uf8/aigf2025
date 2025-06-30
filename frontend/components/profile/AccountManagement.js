'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import useAuthStore from '@/stores/authStore';
import useProfileStore from '@/stores/profileStore';
import toast from 'react-hot-toast';

const AccountManagement = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { reset: resetProfileStore, fetchProfile, fetchUsageStats, deleteAccount } = useProfileStore();
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportData, setExportData] = useState(false);

  const confirmationText = 'DELETE MY ACCOUNT';

  const handleExportData = async () => {
    try {
      // Fetch all user data
      const [profileData, usageData] = await Promise.all([
        fetchProfile(),
        fetchUsageStats()
      ]);

      const exportData = {
        profile: profileData,
        usage: usageData,
        exportDate: new Date().toISOString(),
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `user-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== confirmationText) {
      toast.error('Please type the confirmation text exactly');
      return;
    }

    try {
      setIsDeleting(true);

      // Export data if requested
      if (exportData) {
        await handleExportData();
      }

      // Delete account via API
      await deleteAccount(confirmationText);

      // Sign out from Firebase
      await auth.signOut();

      // Reset stores
      resetProfileStore();

      // Redirect to home
      toast.success('Account deleted successfully');
      router.push('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Account Management</h2>

      {/* Account Information */}
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Account Information</h3>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b gap-1">
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b gap-1">
            <span className="text-sm text-gray-600">Account Type</span>
            <span className="text-sm font-medium text-gray-900">
              {user?.isPremium ? (
                <span className="inline-flex items-center gap-1 text-indigo-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Premium
                </span>
              ) : (
                'Free'
              )}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b gap-1">
            <span className="text-sm text-gray-600">Member Since</span>
            <span className="text-sm font-medium text-gray-900">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Data Export</h3>
        <p className="text-sm text-gray-600 mb-4">
          Download a copy of your data including your profile information and usage statistics.
        </p>
        <button
          onClick={handleExportData}
          className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
        >
          Export My Data
        </button>
      </div>

      {/* Delete Account */}
      <div className="border-t pt-6 sm:pt-8">
        <h3 className="text-base sm:text-lg font-medium text-red-600 mb-4">Danger Zone</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-900 mb-2">Delete Account</h4>
          <p className="text-sm text-red-700 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Delete My Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Are you absolutely sure?
            </h3>
            
            <div className="mb-6 space-y-4">
              <p className="text-sm text-gray-600">
                This action <strong>cannot be undone</strong>. This will permanently delete:
              </p>
              
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Your profile and account information</li>
                <li>All your conversations and messages</li>
                <li>Your usage history and statistics</li>
                <li>Any premium subscription benefits</li>
              </ul>

              <div className="bg-gray-50 p-3 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportData}
                    onChange={(e) => setExportData(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">
                    Export my data before deletion
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Please type <span className="font-mono bg-gray-100 px-1">{confirmationText}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Type confirmation text"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmation('');
                }}
                disabled={isDeleting}
                className="w-full sm:flex-1 px-4 py-3 sm:py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmation !== confirmationText}
                className="w-full sm:flex-1 px-4 py-3 sm:py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;