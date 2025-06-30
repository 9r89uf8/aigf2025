'use client';

import Image from 'next/image';

const CharacterUsageBreakdown = ({ messagesByCharacter, mostChattedCharacters }) => {
  // Get top 5 characters for display
  const topCharacters = messagesByCharacter.slice(0, 5);
  const totalMessages = messagesByCharacter.reduce((sum, char) => sum + char.count, 0);

  if (messagesByCharacter.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Character Usage</h2>
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p>No character conversations yet</p>
          <p className="text-sm mt-1">Start chatting to see your usage breakdown</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Character Usage</h2>
      
      {/* Top Characters List */}
      <div className="space-y-4 mb-6">
        {topCharacters.map((character, index) => {
          const percentage = totalMessages > 0 ? (character.count / totalMessages) * 100 : 0;
          const textRemaining = character.remaining?.text;
          const isPremium = character.limits === null;
          
          return (
            <div key={character.characterId || index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {character.avatar ? (
                    <Image
                      src={character.avatar}
                      alt={character.name}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        {character.name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {character.name || 'Unknown Character'}
                    </p>
                    {!isPremium && (
                      <p className="text-xs text-gray-500">
                        {textRemaining} / {character.limits?.text || 30} messages remaining
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-600 ml-2">
                  {character.count} total
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {/* Usage breakdown for this character */}
              {!isPremium && character.usage && (
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-600 pl-11">
                  <span>💬 {character.usage.text}/{character.limits?.text || 30}</span>
                  <span>🖼️ {character.usage.image}/{character.limits?.image || 5}</span>
                  <span>🎵 {character.usage.audio}/{character.limits?.audio || 5}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show More */}
      {messagesByCharacter.length > 5 && (
        <p className="text-sm text-gray-500 text-center">
          And {messagesByCharacter.length - 5} more characters...
        </p>
      )}

      {/* Most Chatted Characters */}
      {mostChattedCharacters && mostChattedCharacters.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Your Favorites</h3>
          <div className="flex flex-wrap gap-2">
            {mostChattedCharacters.slice(0, 3).map((character, index) => (
              <div
                key={character.characterId || index}
                className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
              >
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                <span>{character.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterUsageBreakdown;