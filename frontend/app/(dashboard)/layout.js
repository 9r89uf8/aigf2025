'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import UserMenu from '@/components/auth/UserMenu';
import useAuthStore from '@/stores/authStore';

const navigation = [
  { name: 'Characters', href: '/characters' },
  { name: 'Profile', href: '/profile' },
  { name: 'Premium', href: '/premium' },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Add admin navigation if user is admin
  const isAdmin = user?.roles?.includes('admin');
  const navItems = isAdmin 
    ? [...navigation, { name: 'Admin', href: '/admin' }]
    : navigation;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <Link href="/" className="text-xl font-bold text-primary">
                    AI Messaging
                  </Link>
                </div>
                {/* Desktop Navigation */}
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  {navItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`${
                        pathname === item.href
                          ? 'border-primary text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Mobile menu button */}
                <button
                  type="button"
                  className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary min-w-[44px] min-h-[44px]"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-expanded={mobileMenuOpen}
                  aria-label="Main menu"
                >
                  {mobileMenuOpen ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
                <UserMenu />
              </div>
            </div>
          </div>

          {/* Mobile menu panel */}
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="sm:hidden fixed inset-0 z-40 bg-black bg-opacity-25"
                onClick={() => setMobileMenuOpen(false)}
              />
              
              {/* Mobile navigation */}
              <div className="sm:hidden absolute top-16 inset-x-0 z-50 bg-white shadow-lg">
                <div className="pt-2 pb-3 space-y-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`${
                        pathname === item.href
                          ? 'bg-primary-50 border-primary text-primary-700'
                          : 'border-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                      } block pl-3 pr-4 py-3 border-l-4 text-base font-medium min-h-[44px] flex items-center`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </nav>

        {/* Main content */}
        <main>{children}</main>
      </div>
    </AuthGuard>
  );
} 