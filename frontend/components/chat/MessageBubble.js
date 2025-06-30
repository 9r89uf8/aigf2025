/**
 * Message Bubble Component
 * Renders different types of messages with proper styling
 */
'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function MessageBubble({ 
  message, 
  character, 
  isOwn, 
  isFailed, 
  hasLLMError = false,
  showAvatar = false,
  onRetry,
  onLike,
  isLiked = false,
  replyToMessage = null,
  shouldShowReplyTo = true,
  retryCount = 0,
  maxRetries = 3
}) {
  const [imageError, setImageError] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);

  const handleLike = () => {
    const newLikedState = !isLiked;
    setLocalIsLiked(newLikedState);
    if (onLike) {
      onLike(message.id, newLikedState);
    }
  };

  const getAnsweredIndicator = () => {
    // Only show checkmark for user messages (own messages)
    if (!isOwn) return null;
    
    // Don't show checkmark for failed messages
    if (message.status === 'failed') return null;
    
    // Show pulse animation for sending messages
    if (message.status === 'sending') {
      return (
        <div className="flex items-center ml-2" title="Sending...">
          <div className="w-2 h-2 bg-white opacity-70 rounded-full animate-pulse"></div>
        </div>
      );
    }
    
    // Show two checkmarks if this message has been answered by AI
    if (message.hasAIResponse || message.status === 'delivered') {
      return (
        <div className="flex items-center ml-2" title="Answered by AI">
          <svg 
            className="w-3 h-3 text-white opacity-70" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
              clipRule="evenodd" 
            />
          </svg>
          <svg 
            className="w-3 h-3 text-white opacity-70 -ml-1" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
      );
    }
    
    // Show single checkmark if message is sent but not yet answered
    if (message.status === 'sent' || (!message.hasAIResponse && message.status !== 'failed')) {
      return (
        <div className="flex items-center ml-2" title="Sent, waiting for AI response">
          <svg 
            className="w-3 h-3 text-white opacity-70" 
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
      );
    }
    
    return null;
  };

  const renderReplyToIndicator = () => {
    if (!replyToMessage || isOwn || !shouldShowReplyTo) return null;
    
    return (
      <div className="mb-2 p-2 bg-blue-50 border-l-4 border-blue-400 rounded-r">
        <div className="text-xs text-blue-600 mb-1 font-medium">
          💬 Replying to:
        </div>
        <div className="text-sm text-gray-700 truncate italic">
          "{replyToMessage.content?.substring(0, 80)}"
          {replyToMessage.content?.length > 80 && '...'}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {formatTime(replyToMessage.timestamp)}
        </div>
      </div>
    );
  };

  const formatTime = (timestamp) => {
    try {
      let date;

      // Handle different timestamp formats
      if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
        // Firestore Timestamp object
        date = timestamp.toDate();
      } else if (timestamp && typeof timestamp === 'object' && timestamp._seconds) {
        // Firebase Timestamp with _seconds and _nanoseconds
        date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
      } else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        // Firestore Timestamp in plain object format
        date = new Date(timestamp.seconds * 1000);
      } else {
        // ISO string or regular timestamp
        date = new Date(timestamp);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting timestamp:', error, timestamp);
      return 'Invalid date';
    }
  };

  const renderTextMessage = () => {
    return (
      <div className="prose prose-sm max-w-none">
        <p className="m-0 whitespace-pre-wrap break-words">
          {message.content}
        </p>
      </div>
    );
  };

  const renderImageMessage = () => {
    if (imageError) {
      return (
        <div className="flex items-center space-x-2 text-gray-500">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
          <span>Image failed to load</span>
        </div>
      );
    }

    return (
      <div className="relative">
        <Image
          src={message.content}
          alt="Shared image"
          width={250}
          height={200}
          className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
          onError={() => setImageError(true)}
          onClick={() => setShowFullImage(true)}
        />
        
        {/* Full Screen Image Modal */}
        {showFullImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
            onClick={() => setShowFullImage(false)}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={message.content}
                alt="Full size image"
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain"
                onError={() => setImageError(true)}
              />
              <button
                onClick={() => setShowFullImage(false)}
                className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAudioMessage = () => {
    return (
      <div className="flex items-center space-x-3 min-w-[200px]">
        <div className="flex-shrink-0">
          <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
        
        <div className="flex-1">
          <audio controls className="w-full">
            <source src={message.content} type="audio/mpeg" />
            <source src={message.content} type="audio/wav" />
            Your browser does not support the audio element.
          </audio>
        </div>
        
        {message.metadata?.duration && (
          <div className="text-xs text-gray-500">
            {Math.round(message.metadata.duration)}s
          </div>
        )}
      </div>
    );
  };

  const renderSystemMessage = () => {
    const getSystemIcon = () => {
      if (message.content.includes('limit')) return '⚠️';
      if (message.content.includes('premium')) return '⭐';
      if (message.content.includes('upgrade')) return '🚀';
      return 'ℹ️';
    };

    return (
      <div className="flex items-center justify-center py-2">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-center max-w-md">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-lg">{getSystemIcon()}</span>
            <span className="text-sm text-gray-700">{message.content}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderLLMErrorContent = () => {
    return (
      <div className="flex items-center space-x-2">
        <div className="flex-shrink-0">
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-red-800 mb-1">
            Service temporarily unavailable
          </div>
          <div className="text-xs text-red-600">
            Please try sending your message again in a moment
          </div>
        </div>
      </div>
    );
  };

  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return renderTextMessage();
      case 'image':
        return renderImageMessage();
      case 'audio':
        return renderAudioMessage();
      case 'system':
        return renderSystemMessage();
      default:
        return renderTextMessage();
    }
  };

  // System messages are rendered differently
  if (message.type === 'system') {
    return renderSystemMessage();
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-3 sm:mt-4' : 'mt-1'}`}>
      {/* Character Avatar */}
      {!isOwn && showAvatar && (
        <div className="flex-shrink-0 mr-2 sm:mr-3">
          <img
            src={character.avatar || '/default-avatar.png'}
            alt={character.name}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
          />
        </div>
      )}

      {/* Message Container */}
      <div className={`max-w-[75%] sm:max-w-xs lg:max-w-md ${!isOwn && !showAvatar ? 'ml-9 sm:ml-11' : ''}`}>
        {/* Character Name (only for first message in group) */}
        {!isOwn && showAvatar && (
          <div className="text-xs text-gray-600 mb-1 px-1">
            {character.name}
          </div>
        )}

        {/* Reply To Indicator */}
        {renderReplyToIndicator()}

        {/* Message Bubble */}
        <div
          className={`rounded-lg px-3 py-2 sm:px-4 sm:py-2 relative transition-all duration-200 text-sm sm:text-base ${
            isOwn
              ? isFailed || hasLLMError
                ? 'bg-red-100 border border-red-300'
                : 'bg-blue-600 text-white shadow-md'
              : replyToMessage
                ? 'bg-green-50 border border-green-200 shadow-sm'
                : 'bg-white border border-gray-200'
          } ${message.status === 'sending' ? 'opacity-70' : ''}`}
        >

          {/* Message Content */}
          {hasLLMError ? renderLLMErrorContent() : renderMessageContent()}

          {/* Message Footer */}
          <div className={`flex items-center justify-between mt-1 text-xs ${
            isOwn ? (hasLLMError ? 'text-red-600' : 'text-blue-100') : 'text-gray-500'
          }`}>
            <span>{formatTime(message.timestamp)}</span>
            
            <div className="flex items-center space-x-2">
              {/* Like Button for AI messages */}
              {!isOwn && (
                <button
                  onClick={handleLike}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  title={isLiked ? "Unlike message" : "Like message"}
                >
                  <svg 
                    className={`w-4 h-4 transition-colors ${
                      isLiked ? 'text-red-500 fill-current' : 'text-gray-400 hover:text-red-400'
                    }`} 
                    fill={isLiked ? 'currentColor' : 'none'} 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
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
              
              {/* AI Like Indicator for User messages */}
              {isOwn && isLiked && (
                <div className="flex items-center">
                  <svg 
                    className="w-4 h-4 text-red-500 fill-current" 
                    viewBox="0 0 24 24"
                    title="AI liked this message"
                  >
                    <path 
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
                    />
                  </svg>
                </div>
              )}
              
              {/* Answered Indicator for User messages */}
              {getAnsweredIndicator()}
              
            </div>
          </div>

          {/* Failed Message Indicator */}
          {isFailed && (
            <div className="absolute -right-2 -bottom-2">
              <div className="relative">
                <button
                  onClick={onRetry}
                  disabled={retryCount >= maxRetries}
                  className={`rounded-full p-1 transition-colors ${
                    retryCount >= maxRetries 
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                  title={
                    retryCount >= maxRetries 
                      ? `Maximum retries reached (${retryCount}/${maxRetries})` 
                      : `Retry message (${retryCount}/${maxRetries} attempts)`
                  }
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Retry Count Badge */}
                {retryCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold border border-white">
                    {retryCount}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LLM Error Retry Button */}
          {hasLLMError && isOwn && (
            <div className="absolute -right-2 -bottom-2">
              <div className="relative">
                <button
                  onClick={onRetry}
                  disabled={retryCount >= maxRetries}
                  className={`rounded-full p-1 transition-colors ${
                    retryCount >= maxRetries 
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                  title={
                    retryCount >= maxRetries 
                      ? `Maximum retries reached (${retryCount}/${maxRetries})` 
                      : `Retry message (${retryCount}/${maxRetries} attempts) - AI service is back online`
                  }
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Retry Count Badge */}
                {retryCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold border border-white">
                    {retryCount}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* File Metadata */}
        {message.metadata && (message.type === 'image' || message.type === 'audio') && (
          <div className="text-xs text-gray-500 mt-1 px-1">
            {message.metadata.filename && (
              <div>📁 {message.metadata.filename}</div>
            )}
            {message.metadata.fileSize && (
              <div>💾 {(message.metadata.fileSize / 1024).toFixed(1)} KB</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}