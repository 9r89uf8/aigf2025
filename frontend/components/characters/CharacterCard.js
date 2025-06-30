'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import useCharacterStore from '@/stores/characterStore';
import useAuthStore from '@/stores/authStore';

export default function CharacterCard({ character }) {

  const { toggleFavorite, favorites } = useCharacterStore();
  const { user } = useAuthStore();
  const [imageError, setImageError] = useState(false);
  
  const isFavorite = favorites.has(character.id);

  const handleFavoriteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (user) {
      toggleFavorite(character.id);
    }
  };

  // Get personality traits (max 3)
  const traits = character.personality.traits?.slice(0, 3) || [];


  return (
    <Link href={`/characters/${character.id}`}>
      <div className="group relative bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden">
        {/* Image Container */}
        <div className="relative h-48 sm:h-56 md:h-64 w-full overflow-hidden bg-gray-200">
          {!imageError ? (
            <Image
              src={character.profileImage || '/images/default-avatar.png'}
              alt={character.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-300">
              <svg className="w-20 h-20 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          
          {/* Online Status Indicator */}
          {character.isOnline && (
            <div className="absolute top-2 right-2 flex items-center space-x-1 bg-green-500 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></div>
              <span className="hidden sm:inline">Online</span>
            </div>
          )}

          {/* Favorite Button */}
          {user && (
            <button
              onClick={handleFavoriteClick}
              className="absolute top-2 left-2 p-1.5 sm:p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg
                className={`w-5 h-5 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`}
                fill={isFavorite ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          {/* Name and Age */}
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{character.name}</h3>
            <span className="text-xs sm:text-sm text-gray-500 flex-shrink-0 ml-2">{character.age}y</span>
          </div>

          {/* Bio */}
          <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-2">
            {character.bio || 'No bio available'}
          </p>

          {/* Personality Traits */}
          {traits.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
              {traits.map((trait, index) => (
                <span
                  key={index}
                  className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full"
                >
                  {trait}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              {/* Message Count */}
              {character.messageCount > 0 && (
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>{character.messageCount}</span>
                </div>
              )}
              
              {/* View Count */}
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>{character.viewCount || 0}</span>
              </div>
            </div>

            {/* Chat Now Button */}
            <button className="text-primary hover:text-primary-dark font-medium flex items-center space-x-1 group">
              <span>Chat</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
} 