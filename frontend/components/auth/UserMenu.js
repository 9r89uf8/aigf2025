'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, Transition } from '@headlessui/react';
import useAuthStore from '@/stores/authStore';
import useChatStore from '@/stores/chatStore';

export default function UserMenu() {
  const { user, logout, isPremium } = useAuthStore();
  const { characterUsage } = useChatStore();
  const [totalUsed, setTotalUsed] = useState(0);
  const [messagesRemaining, setMessagesRemaining] = useState(30);

  // Calculate usage from characterUsage
  useEffect(() => {
    if (!isPremium && characterUsage.size > 0) {
      let total = 0;
      characterUsage.forEach((usage) => {
        total += usage.text.used;
      });
      setTotalUsed(total);
      setMessagesRemaining(Math.max(0, 30 - total));
    }
  }, [characterUsage, isPremium]);

  if (!user) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href="/login"
          className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="bg-primary text-white hover:bg-primary-dark px-4 py-2 rounded-md text-sm font-medium"
        >
          Get Started
        </Link>
      </div>
    );
  }

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary p-1 sm:p-0">
        <span className="sr-only">Open user menu</span>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{user.displayName || user.username}</p>
            {isPremium ? (
              <p className="text-xs text-primary">Premium Member</p>
            ) : (
              <p className="text-xs text-gray-500">
                {messagesRemaining} messages left
              </p>
            )}
          </div>
          <div className="relative">
            <img
              className="h-8 w-8 sm:h-8 sm:w-8 rounded-full"
              src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.username)}`}
              alt={user.displayName || user.username}
            />
            {!isPremium && messagesRemaining <= 5 && messagesRemaining > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </div>
        </div>
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-50 mt-2 w-56 sm:w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none max-h-[calc(100vh-100px)] overflow-y-auto">
          {/* Mobile user info */}
          <div className="sm:hidden px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-900">{user.displayName || user.username}</p>
            {isPremium ? (
              <p className="text-xs text-primary mt-1">Premium Member</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                {messagesRemaining} messages left
              </p>
            )}
          </div>
          
          <Menu.Item>
            {({ active }) => (
              <Link
                href="/profile"
                className={`${
                  active ? 'bg-gray-100' : ''
                } block px-4 py-3 sm:py-2 text-sm text-gray-700 min-h-[44px] sm:min-h-0 flex items-center`}
              >
                <div className="flex items-center">
                  <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Your Profile
                </div>
              </Link>
            )}
          </Menu.Item>
          
          <Menu.Item>
            {({ active }) => (
              <Link
                href="/profile/usage"
                className={`${
                  active ? 'bg-gray-100' : ''
                } block px-4 py-3 sm:py-2 text-sm text-gray-700 min-h-[44px] sm:min-h-0 flex items-center`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Usage Stats
                  </div>
                  {!isPremium && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      messagesRemaining <= 5 ? 'bg-red-100 text-red-700' : 
                      messagesRemaining <= 10 ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {messagesRemaining}
                    </span>
                  )}
                </div>
              </Link>
            )}
          </Menu.Item>

          <Menu.Item>
            {({ active }) => (
              <Link
                href="/profile/settings"
                className={`${
                  active ? 'bg-gray-100' : ''
                } block px-4 py-3 sm:py-2 text-sm text-gray-700 min-h-[44px] sm:min-h-0 flex items-center`}
              >
                <div className="flex items-center">
                  <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </div>
              </Link>
            )}
          </Menu.Item>

          <hr className="my-1" />
          
          <Menu.Item>
            {({ active }) => (
              <Link
                href="/characters"
                className={`${
                  active ? 'bg-gray-100' : ''
                } block px-4 py-3 sm:py-2 text-sm text-gray-700 min-h-[44px] sm:min-h-0 flex items-center`}
              >
                <div className="flex items-center">
                  <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Browse Characters
                </div>
              </Link>
            )}
          </Menu.Item>

          {!isPremium && (
            <Menu.Item>
              {({ active }) => (
                <Link
                  href="/premium"
                  className={`${
                    active ? 'bg-gray-100' : ''
                  } block px-4 py-3 sm:py-2 text-sm text-primary font-medium min-h-[44px] sm:min-h-0 flex items-center`}
                >
                  Upgrade to Premium
                </Link>
              )}
            </Menu.Item>
          )}

          <hr className="my-1" />

          <Menu.Item>
            {({ active }) => (
              <button
                onClick={logout}
                className={`${
                  active ? 'bg-gray-100' : ''
                } block w-full text-left px-4 py-3 sm:py-2 text-sm text-gray-700 min-h-[44px] sm:min-h-0 flex items-center`}
              >
                Sign out
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
} 