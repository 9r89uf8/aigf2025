'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import useCharacterStore from '@/stores/characterStore';
import useAuthStore from '@/stores/authStore';
import CharacterGallery from '@/components/characters/CharacterGallery';
import toast from 'react-hot-toast';

export default function CharacterProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    selectedCharacter, 
    gallery,
    loading, 
    fetchCharacterById, 
    fetchCharacterGallery,
    toggleFavorite,
    favorites,
    clearSelectedCharacter
  } = useCharacterStore();
  
  const [activeTab, setActiveTab] = useState('about');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Fetch character details and gallery
    const loadCharacterData = async () => {
      try {
        await fetchCharacterById(params.id);
        await fetchCharacterGallery(params.id);
      } catch (error) {
        toast.error('Failed to load character details');
        router.push('/characters');
      }
    };

    loadCharacterData();

    // Cleanup on unmount
    return () => {
      clearSelectedCharacter();
    };
  }, [params.id]);

  const handleStartChat = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    router.push(`/chat/${params.id}`);
  };

  const isFavorite = selectedCharacter && favorites.has(selectedCharacter.id);

  if (loading && !selectedCharacter) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!selectedCharacter) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/characters" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Characters
          </Link>
        </div>
      </div>

      {/* Profile Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="md:flex">
            {/* Profile Image */}
            <div className="md:w-1/3">
              <div className="relative h-96 md:h-full">
                {!imageError ? (
                  <Image
                    src={selectedCharacter.profileImage || '/images/default-avatar.png'}
                    alt={selectedCharacter.name}
                    fill
                    className="object-cover"
                    onError={() => setImageError(true)}
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-300">
                    <svg className="w-24 h-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                
                {/* Online Status */}
                {selectedCharacter.isOnline && (
                  <div className="absolute top-4 left-4 flex items-center space-x-1 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>Online</span>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="md:w-2/3 p-6 md:p-8">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{selectedCharacter.name}</h1>
                  <p className="text-lg text-gray-600">Age: {selectedCharacter.age}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleFavorite(selectedCharacter._id)}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <svg
                      className={`w-6 h-6 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`}
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
                  <button
                    onClick={handleStartChat}
                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
                  >
                    Start Chatting
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('about')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'about'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    About
                  </button>
                  <button
                    onClick={() => setActiveTab('personality')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'personality'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Personality
                  </button>
                  <button
                    onClick={() => setActiveTab('gallery')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'gallery'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Gallery {gallery.items.length > 0 && `(${gallery.items.length})`}
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              <div className="mt-6">
                {/* About Tab */}
                {activeTab === 'about' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Bio</h3>
                      <p className="text-gray-600 whitespace-pre-wrap">
                        {selectedCharacter.bio || 'No bio available'}
                      </p>
                    </div>
                    
                    {selectedCharacter.background && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Background</h3>
                        <p className="text-gray-600 whitespace-pre-wrap">
                          {selectedCharacter.background}
                        </p>
                      </div>
                    )}

                    {selectedCharacter.interests && selectedCharacter.interests.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Interests</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedCharacter.interests.map((interest, index) => (
                            <span
                              key={index}
                              className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Personality Tab */}
                {activeTab === 'personality' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Personality Traits</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCharacter.personality.traits?.map((trait, index) => (
                          <span
                            key={index}
                            className="inline-block px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedCharacter.conversationStyle && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Conversation Style</h3>
                        <p className="text-gray-600">{selectedCharacter.conversationStyle}</p>
                      </div>
                    )}

                    {selectedCharacter.voiceDescription && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Voice Description</h3>
                        <p className="text-gray-600">{selectedCharacter.voiceDescription}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Gallery Tab */}
                {activeTab === 'gallery' && (
                  <div>
                    {gallery.loading ? (
                      <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <CharacterGallery characterId={params.id} items={gallery.items} />
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-1">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{selectedCharacter.viewCount || 0} views</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>{selectedCharacter.messageCount || 0} conversations</span>
                    </div>
                  </div>
                  <span className="text-xs">Created {new Date(selectedCharacter.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 