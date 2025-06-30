/**
 * Usage Counter Component
 * Displays remaining message limits with progress bars
 */
'use client';

import { useState } from 'react';
import useChatStore from '@/stores/chatStore';
import useAuthStore from '@/stores/authStore';

export default function UsageCounter({ characterId, className = '' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { getCharacterUsage } = useChatStore();
  const { isPremium } = useAuthStore();
  
  // Get usage for specific character
  const usage = getCharacterUsage(characterId);

  // Don't show for premium users
  if (isPremium) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex items-center space-x-1 text-yellow-600">
          <span className="text-lg">⭐</span>
          <span className="text-sm font-medium">Premium</span>
        </div>
      </div>
    );
  }

  const getUsageColor = (used, limit) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 100) return 'red';
    if (percentage >= 80) return 'orange';
    if (percentage >= 60) return 'yellow';
    return 'green';
  };

  const getUsageIcon = (type) => {
    switch (type) {
      case 'text': return '💬';
      case 'image': return '🖼️';
      case 'audio': return '🎤';
      default: return '📊';
    }
  };

  const renderUsageBar = (type, data) => {
    const { used, limit } = data;
    const percentage = Math.min((used / limit) * 100, 100);
    const color = getUsageColor(used, limit);
    
    const colorClasses = {
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500'
    };

    const bgClasses = {
      green: 'bg-green-100',
      yellow: 'bg-yellow-100',
      orange: 'bg-orange-100',
      red: 'bg-red-100'
    };

    return (
      <div key={type} className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1">
            <span>{getUsageIcon(type)}</span>
            <span className="capitalize font-medium">{type}</span>
          </div>
          <span className={`font-mono text-xs ${
            used >= limit ? 'text-red-600' : 'text-gray-600'
          }`}>
            {used}/{limit}
          </span>
        </div>
        
        <div className={`w-full h-2 rounded-full ${bgClasses[color]}`}>
          <div
            className={`h-2 rounded-full transition-all duration-300 ${colorClasses[color]}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {used >= limit && (
          <div className="text-xs text-red-600 font-medium">
            Limit reached! Upgrade to premium for unlimited access.
          </div>
        )}
      </div>
    );
  };

  // Calculate total usage percentage for compact view
  const totalUsed = usage.text.used + usage.image.used + usage.audio.used;
  const totalLimit = usage.text.limit + usage.image.limit + usage.audio.limit;
  const totalPercentage = Math.min((totalUsed / totalLimit) * 100, 100);
  const overallColor = getUsageColor(totalUsed, totalLimit);

  const colorClasses = {
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    orange: 'text-orange-600 bg-orange-100',
    red: 'text-red-600 bg-red-100'
  };

  return (
    <div className={`relative ${className}`}>
      {/* Compact View */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors ${
          colorClasses[overallColor]
        } hover:opacity-80`}
      >
        <span className="text-sm font-medium">
          {totalUsed}/{totalLimit}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="sm:hidden fixed inset-0 z-40 bg-black bg-opacity-25"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Dropdown panel */}
          <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-[calc(100vw-24px)] max-w-[320px] sm:min-w-[280px] z-50">
            <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-semibold text-gray-900">Usage Limits</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-3">
              {renderUsageBar('text', usage.text)}
              {renderUsageBar('image', usage.image)}
              {renderUsageBar('audio', usage.audio)}
            </div>

            {/* Upgrade Button */}
            <div className="border-t border-gray-100 pt-3">
              <button 
                onClick={() => window.location.href = '/premium'}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium text-sm"
              >
                ⭐ Upgrade to Premium
              </button>
              <p className="text-xs text-gray-500 text-center mt-1">
                Unlimited messages • Priority support
              </p>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}