'use client';

import { useState, useEffect } from 'react';
import useAuthStore from '@/stores/authStore';
import useProfileStore from '@/stores/profileStore';
import useChatStore from '@/stores/chatStore';
import UsageOverview from '@/components/profile/UsageOverview';
import CharacterUsageBreakdown from '@/components/profile/CharacterUsageBreakdown';
import MessageTypeBreakdown from '@/components/profile/MessageTypeBreakdown';
import PremiumUpsell from '@/components/profile/PremiumUpsell';

const UsagePage = () => {
  const { user, isPremium } = useAuthStore();
  const { 
    usageStats, 
    isLoadingStats, 
    statsError,
    fetchUsageStats,
    updateUsageStats
  } = useProfileStore();
  const { characterUsage } = useChatStore();

  useEffect(() => {
    fetchUsageStats();
  }, [fetchUsageStats]);

  // Listen for real-time usage updates from chat store
  useEffect(() => {
    // Calculate total remaining messages from character usage
    if (characterUsage.size > 0 && !isPremium) {
      let totalUsed = 0;
      characterUsage.forEach((usage) => {
        totalUsed += usage.text.used;
      });
      
      const messagesRemaining = Math.max(0, 30 - totalUsed);
      updateUsageStats({ messagesRemaining });
    }
  }, [characterUsage, isPremium, updateUsageStats]);

  if (isLoadingStats) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Usage Statistics</h1>
        <div className="space-y-6">
          {/* Loading skeleton for overview */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Loading skeleton for charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-48 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Usage Statistics</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading statistics</p>
          <p className="text-sm mt-1">{statsError}</p>
          <button
            onClick={() => fetchUsageStats()}
            className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Usage Statistics</h1>
        <button
          onClick={() => fetchUsageStats()}
          className="self-start sm:self-auto text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="space-y-6">
        {/* Usage Overview */}
        <UsageOverview stats={usageStats} isPremium={isPremium} />

        {/* Premium Upsell for Free Users */}
        {!isPremium && usageStats.messagesRemaining !== null && usageStats.messagesRemaining <= 10 && (
          <PremiumUpsell 
            messagesRemaining={usageStats.messagesRemaining}
            resetTime={usageStats.resetTime}
          />
        )}

        {/* Detailed Breakdowns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <CharacterUsageBreakdown 
            messagesByCharacter={usageStats.messagesByCharacter}
            mostChattedCharacters={usageStats.mostChattedCharacters}
          />
          <MessageTypeBreakdown 
            breakdown={usageStats.messageTypeBreakdown}
            totalMessages={usageStats.totalMessages}
          />
        </div>
      </div>
    </div>
  );
};

export default UsagePage;