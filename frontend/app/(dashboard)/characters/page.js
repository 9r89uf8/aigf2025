'use client';

import { useEffect, useState } from 'react';
import useCharacterStore from '@/stores/characterStore';
import useAuthStore from '@/stores/authStore';
import CharacterCard from '@/components/characters/CharacterCard';
import CharacterFilter from '@/components/characters/CharacterFilter';

export default function CharactersPage() {
  const { 
    characters, 
    loading, 
    error, 
    pagination,
    fetchCharacters, 
    loadMore,
    loadFavorites 
  } = useCharacterStore();
  
  const { initialized, user } = useAuthStore();
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    // Only fetch characters after auth is initialized and user is authenticated
    if (initialized && user && initialLoad) {
      // Load favorites from localStorage
      loadFavorites();
      
      // Initial fetch
      fetchCharacters(true);
      setInitialLoad(false);
    }
  }, [initialized, user, initialLoad, fetchCharacters, loadFavorites]);

  const handleLoadMore = () => {
    if (!loading && pagination.hasMore) {
      loadMore();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Discover Characters</h1>
              <p className="mt-1 text-sm text-gray-600">
                Find your perfect AI companion from our diverse collection
              </p>
            </div>
            <CharacterFilter />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Characters Grid */}
        {characters.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {characters.map((character) => (
                <CharacterCard 
                  key={character.id} 
                  character={character} 
                />
              ))}
            </div>

            {/* Load More Button */}
            {pagination.hasMore && (
              <div className="mt-8 sm:mt-12 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 border border-transparent text-sm sm:text-base font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </>
                  ) : (
                    'Load More Characters'
                  )}
                </button>
              </div>
            )}
          </>
        ) : loading && initialLoad ? (
          // Loading State - Fixed skeleton items with stable keys
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {Array.from({ length: 8 }, (_, index) => (
              <div 
                key={`skeleton-${index}`} 
                className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse"
              >
                <div className="h-48 sm:h-56 md:h-64 bg-gray-300"></div>
                <div className="p-3 sm:p-4">
                  <div className="h-5 sm:h-6 bg-gray-300 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2 sm:mb-3"></div>
                  <div className="flex space-x-2">
                    <div className="h-5 sm:h-6 bg-gray-300 rounded w-14 sm:w-16"></div>
                    <div className="h-5 sm:h-6 bg-gray-300 rounded w-14 sm:w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Empty State
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No characters found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or check back later for new characters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}