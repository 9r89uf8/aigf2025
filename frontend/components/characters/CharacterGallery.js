'use client';

import { useState } from 'react';
import Image from 'next/image';
import useAuthStore from '@/stores/authStore';
import useCharacterStore from '@/stores/characterStore';
import { useRouter } from 'next/navigation';

export default function CharacterGallery({ characterId, items = [] }) {
  const router = useRouter();
  const { isPremium } = useAuthStore();
  const { trackGalleryView, selectGalleryItem } = useCharacterStore();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleItemClick = async (item, index) => {
    if (!item.isPremium || isPremium) {
      setCurrentIndex(index);
      setLightboxOpen(true);
      selectGalleryItem(item);
      
      // Track view for analytics
      await trackGalleryView(characterId, item._id);
    } else {
      // Show premium prompt
      router.push('/premium');
    }
  };

  const navigateLightbox = (direction) => {
    let newIndex = currentIndex;
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % items.length;
    } else {
      newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
    }
    
    setCurrentIndex(newIndex);
    selectGalleryItem(items[newIndex]);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    selectGalleryItem(null);
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No gallery items available</p>
      </div>
    );
  }

  return (
    <>
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item, index) => (
          <div
            key={item._id}
            className="relative aspect-square cursor-pointer group"
            onClick={() => handleItemClick(item, index)}
          >
            {/* Image Container */}
            <div className="relative w-full h-full overflow-hidden rounded-lg bg-gray-200">
              <Image
                src={item.thumbnail || item.url}
                alt={item.caption || `Gallery item ${index + 1}`}
                fill
                className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
                  item.isPremium && !isPremium ? 'blur-lg' : ''
                }`}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              
              {/* Premium Overlay */}
              {item.isPremium && !isPremium && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white">
                  <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm font-medium">Premium Content</span>
                </div>
              )}

              {/* Video Indicator */}
              {item.type === 'video' && (
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-white text-xs flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  {item.duration || 'Video'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation Buttons */}
          <button
            onClick={() => navigateLightbox('prev')}
            className="absolute left-4 text-white hover:text-gray-300"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => navigateLightbox('next')}
            className="absolute right-4 text-white hover:text-gray-300"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Content */}
          <div className="max-w-5xl max-h-screen p-4">
            {items[currentIndex].type === 'video' ? (
              <video
                src={items[currentIndex].url}
                controls
                autoPlay
                className="max-w-full max-h-full"
              />
            ) : (
              <Image
                src={items[currentIndex].url}
                alt={items[currentIndex].caption || 'Gallery image'}
                width={1200}
                height={800}
                className="max-w-full max-h-full object-contain"
              />
            )}
            
            {/* Caption */}
            {items[currentIndex].caption && (
              <p className="text-white text-center mt-4">
                {items[currentIndex].caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
} 