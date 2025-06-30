'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

const NotificationSettings = () => {
  const [notifications, setNotifications] = useState({
    emailMarketing: false,
    emailUpdates: true,
    emailSecurity: true,
    pushMessages: true,
    pushUpdates: false,
  });

  const handleToggle = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    
    // In a real app, this would save to the backend
    toast.success('Notification preferences updated');
  };

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Notification Settings</h2>

      <div className="space-y-6">
        {/* Email Notifications */}
        <div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Email Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">Security Alerts</p>
                <p className="text-sm text-gray-500">Get notified about account security</p>
              </div>
              <button
                onClick={() => handleToggle('emailSecurity')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.emailSecurity ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.emailSecurity ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">Product Updates</p>
                <p className="text-sm text-gray-500">News about new features and updates</p>
              </div>
              <button
                onClick={() => handleToggle('emailUpdates')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.emailUpdates ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.emailUpdates ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">Marketing</p>
                <p className="text-sm text-gray-500">Promotional offers and announcements</p>
              </div>
              <button
                onClick={() => handleToggle('emailMarketing')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.emailMarketing ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.emailMarketing ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="pt-6 border-t">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Push Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">New Messages</p>
                <p className="text-sm text-gray-500">Get notified when characters reply</p>
              </div>
              <button
                onClick={() => handleToggle('pushMessages')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.pushMessages ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.pushMessages ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">App Updates</p>
                <p className="text-sm text-gray-500">Notifications about app features</p>
              </div>
              <button
                onClick={() => handleToggle('pushUpdates')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.pushUpdates ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.pushUpdates ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Note:</strong> You can unsubscribe from email notifications at any time by clicking the unsubscribe link in any email.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;