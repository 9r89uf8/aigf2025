'use client';

import { useState, useEffect } from 'react';
import useCharacterStore from '@/stores/characterStore';

const personalities = [
  'Friendly', 'Romantic', 'Adventurous', 'Mysterious', 
  'Playful', 'Intellectual', 'Caring', 'Bold',
  'Humorous', 'Creative', 'Confident', 'Gentle'
];

export default function CharacterFilter() {
  const { filters, setFilters, clearFilters, fetchCharacters } = useCharacterStore();
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    setFilters(localFilters);
    fetchCharacters(true);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    clearFilters();
    setLocalFilters({
      search: '',
      gender: '',
      personality: '',
      minAge: null,
      maxAge: null,
    });
    fetchCharacters(true);
    setIsOpen(false);
  };

  const hasActiveFilters = () => {
    return filters.search || filters.gender || filters.personality || 
           filters.minAge || filters.maxAge;
  };

  return (
    <div className="relative">
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span>Filters</span>
        {hasActiveFilters() && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
            {Object.values(filters).filter(v => v).length}
          </span>
        )}
      </button>

      {/* Filter Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black bg-opacity-25 sm:bg-transparent" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Filter Panel - Full screen on mobile, dropdown on desktop */}
          <div className="fixed sm:absolute inset-x-0 bottom-0 sm:inset-auto sm:top-full sm:mt-2 sm:right-0 sm:bottom-auto w-full sm:w-80 bg-white rounded-t-lg sm:rounded-lg shadow-xl border border-gray-200 z-50 max-h-[90vh] sm:max-h-[600px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Filter Characters</h3>
              {/* Mobile close button */}
              <button
                onClick={() => setIsOpen(false)}
                className="sm:hidden p-2 -mr-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={localFilters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Name or bio..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={localFilters.gender}
                  onChange={(e) => handleFilterChange('gender', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All Genders</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non-binary">Non-binary</option>
                </select>
              </div>

              {/* Personality */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personality
                </label>
                <select
                  value={localFilters.personality}
                  onChange={(e) => handleFilterChange('personality', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All Personalities</option>
                  {personalities.map(personality => (
                    <option key={personality} value={personality.toLowerCase()}>
                      {personality}
                    </option>
                  ))}
                </select>
              </div>

              {/* Age Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age Range
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={localFilters.minAge || ''}
                    onChange={(e) => handleFilterChange('minAge', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Min"
                    min="18"
                    max="100"
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="number"
                    value={localFilters.maxAge || ''}
                    onChange={(e) => handleFilterChange('maxAge', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Max"
                    min="18"
                    max="100"
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 space-y-3 sm:space-y-0 sm:flex sm:justify-between">
              <button
                onClick={handleClearFilters}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 order-2 sm:order-1"
              >
                Clear All
              </button>
              <div className="flex gap-2 sm:space-x-2 order-1 sm:order-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 