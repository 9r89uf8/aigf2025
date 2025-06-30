/**
 * Typing Indicator Component
 * Shows when character is typing
 */
'use client';

import { useEffect, useState } from 'react';

export default function TypingIndicator({ users = [], character }) {
  const [dotCount, setDotCount] = useState(1);

  // Animate dots
  useEffect(() => {
    if (users.length === 0) return;

    const interval = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 500);

    return () => clearInterval(interval);
  }, [users.length]);

  if (users.length === 0) return null;

  const renderTypingDots = () => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-2 h-2 bg-gray-400 rounded-full transition-opacity duration-300 ${
              i <= dotCount ? 'opacity-100' : 'opacity-30'
            }`}
          />
        ))}
      </div>
    );
  };

  const getTypingText = () => {
    if (users.length === 1) {
      // Character typing - use character name or fallback
      const characterName = character?.name || 'emely';
      return `${characterName} is typing`;
    } else {
      // Multiple users typing (shouldn't happen in character chat, but good to handle)
      return `${users.length} people are typing`;
    }
  };

  return (
    <div className="flex justify-start">
      <div className="flex items-center space-x-3">
        {/* Character Avatar */}
        <div className="flex-shrink-0">
          <img
            src={character.avatar || '/default-avatar.png'}
            alt={character.name}
            className="w-8 h-8 rounded-full object-cover"
          />
        </div>

        {/* Typing Bubble */}
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-xs">
          <div className="flex items-center space-x-2">
            {/* Typing Animation */}
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            
            {/* Typing Text */}
            <span className="text-xs text-gray-500">
              {getTypingText()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}