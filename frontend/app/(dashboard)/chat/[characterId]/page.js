/**
 * Chat Page
 * react component that uses the socket client to connect
 * Real-time chat interface with a specific character
 */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useChatStore from '@/stores/chatStore';
import useCharacterStore from '@/stores/characterStore';
import useAuthStore from '@/stores/authStore';
import ChatInterface from '@/components/chat/ChatInterface';
import UsageCounter from '@/components/chat/UsageCounter';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const { characterId } = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [character, setCharacter] = useState(null);
  
  // Store hooks
  const { user } = useAuthStore();
  const { fetchCharacterById } = useCharacterStore();
  const { 
    initialize, 
    joinConversation, 
    leaveConversation, 
    isConnected, 
    isConnecting, 
    connectionError,
    activeConversationId,
    cleanup
  } = useChatStore();

  useEffect(() => {
    // AuthGuard already handles authentication, so just initialize the page
    initializePage();

    // Cleanup on unmount
    return () => {
      leaveConversation();
    };
  }, [characterId]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const initializePage = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize chat connection
      if (!isConnected && !isConnecting) {
        await initialize();
      }

      // Fetch character data
      try {
        const characterData = await fetchCharacterById(characterId);
        setCharacter(characterData.character || characterData);
      } catch (err) {
        console.error('Failed to fetch character:', err);
        setError('Character not found');
        return;
      }

      // Generate proper conversation ID and join conversation
      const conversationId = `${user.uid}_${characterId}`;
      await joinConversation(conversationId, characterId);

    } catch (err) {
      console.error('Failed to initialize chat page:', err);
      setError(err.message || 'Failed to initialize chat');
      toast.error('Failed to load chat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryConnection = async () => {
    try {
      await initialize();
    } catch (err) {
      toast.error('Failed to reconnect');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Chat Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/characters')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Characters
          </button>
        </div>
      </div>
    );
  }

  // Connection error state
  if (connectionError && !isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-yellow-500 text-4xl mb-4">📡</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{connectionError}</p>
          <button
            onClick={handleRetryConnection}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors mr-2"
          >
            Retry Connection
          </button>
          <button
            onClick={() => router.push('/characters')}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Characters
          </button>
        </div>
      </div>
    );
  }

  // Character not found
  if (!character) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-gray-400 text-4xl mb-4">🤖</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Character Not Found</h2>
          <p className="text-gray-600 mb-4">The character you are looking for does not exist.</p>
          <button
            onClick={() => router.push('/characters')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Characters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Left section - Back button and character info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => router.push('/characters')}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 sm:p-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
              aria-label="Back to characters"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <img
                src={character.avatar || '/default-avatar.png'}
                alt={character.name}
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h1 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{character.name}</h1>
                <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500">
                  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  <span className="truncate">{isConnected ? 'Online' : 'Connecting...'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right section - Usage Counter */}
          <div className="flex-shrink-0">
            <UsageCounter characterId={characterId} />
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <ChatInterface 
        character={character}
        conversationId={activeConversationId}
        characterId={characterId}
        className="flex-1"
      />
    </div>
  );
}