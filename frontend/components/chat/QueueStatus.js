/**
 * Queue Status Component
 * Shows real-time message queue status for natural messaging flow
 * 
 * References: NATURAL_MESSAGE_QUEUING_PLAN.md - Phase 4
 */
'use client';

import { useEffect, useState } from 'react';
import useChatStore from '@/stores/chatStore';

export default function QueueStatus({ conversationId, className = '' }) {
  const [isVisible, setIsVisible] = useState(false);
  const { getQueueStatus } = useChatStore();
  
  const queueStatus = getQueueStatus(conversationId);
  const { queueLength, state, currentlyProcessing, hasQueuedMessages } = queueStatus;

  // Show queue status when there are queued messages or processing
  useEffect(() => {
    const shouldShow = hasQueuedMessages || state === 'processing';
    setIsVisible(shouldShow);
  }, [hasQueuedMessages, state]);

  // Auto-hide after queue is processed
  useEffect(() => {
    if (state === 'idle' && queueLength === 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state, queueLength]);

  if (!isVisible) return null;

  const getStatusColor = () => {
    switch (state) {
      case 'processing':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'idle':
        return 'bg-green-100 border-green-300 text-green-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getStatusIcon = () => {
    switch (state) {
      case 'processing':
        return (
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
        );
      case 'queued':
        return (
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-yellow-600 rounded-full animate-pulse"></div>
            <div className="w-1 h-1 bg-yellow-600 rounded-full animate-pulse delay-75"></div>
            <div className="w-1 h-1 bg-yellow-600 rounded-full animate-pulse delay-150"></div>
          </div>
        );
      case 'idle':
        return (
          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'processing':
        return getBeautifulResponseMessage();
      case 'queued':
        return queueLength > 1 
          ? `${queueLength} messages in queue`
          : '1 message in queue';
      case 'idle':
        return 'Queue processed';
      default:
        return 'Processing...';
    }
  };

  const getBeautifulResponseMessage = () => {
    // Beautiful, character-aware response messages
    const messages = [
      '✨ Thinking...',
      '💭 Crafting a response...',
      '🌟 Preparing something special...',
      '💫 Weaving words...',
      '🎭 Getting into character...',
      '📝 Penning thoughts...',
      '🌸 Creating magic...',
      '💝 Composing a reply...',
      '🦋 Finding the perfect words...',
      '🌙 Channeling inspiration...'
    ];
    
    // Use a simple rotation based on current time to avoid repetition
    // This ensures different messages on each processing event
    const messageIndex = Math.floor(Date.now() / 2000) % messages.length;
    return messages[messageIndex];
  };

  const getDetailText = () => {
    if (state === 'processing' && queueLength > 0) {
      return `${queueLength} more message${queueLength > 1 ? 's' : ''} waiting`;
    }
    if (state === 'queued') {
      return 'AI will respond to each message individually';
    }
    return null;
  };

  return (
    <div className={`transition-all duration-300 ease-in-out ${className}`}>
      <div className={`mx-4 mb-3 px-3 py-2 rounded-lg border ${getStatusColor()} transition-colors duration-200`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">
              {getStatusText()}
            </span>
          </div>
          
          {queueLength > 0 && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-current rounded-full opacity-60"></div>
              <span className="text-xs font-semibold">
                {queueLength}
              </span>
            </div>
          )}
        </div>
        
        {getDetailText() && (
          <div className="mt-1">
            <p className="text-xs opacity-75">
              {getDetailText()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mini Queue Status Component (for message input area)
 */
export function MiniQueueStatus({ conversationId, className = '' }) {
  const { getQueueStatus } = useChatStore();
  const queueStatus = getQueueStatus(conversationId);
  const { queueLength, state, hasQueuedMessages } = queueStatus;

  const getBeautifulMiniMessage = () => {
    // Shorter, compact beautiful messages for mini display
    const miniMessages = [
      '✨ Thinking...',
      '💭 Writing...',
      '🌟 Creating...',
      '💫 Crafting...',
      '🎭 Responding...',
      '📝 Composing...',
      '🌸 Weaving...',
      '💝 Preparing...'
    ];
    
    // Use time-based rotation for variety
    const messageIndex = Math.floor(Date.now() / 2000) % miniMessages.length;
    return miniMessages[messageIndex];
  };

  if (!hasQueuedMessages && state !== 'processing') return null;

  return (
    <div className={`flex items-center space-x-2 text-xs text-gray-500 ${className}`}>
      {state === 'processing' && (
        <>
          <div className="animate-spin rounded-full h-2 w-2 border-b border-blue-600"></div>
          <span>{getBeautifulMiniMessage()}</span>
        </>
      )}
      
      {state === 'queued' && queueLength > 0 && (
        <>
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse"></div>
            <div className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse delay-75"></div>
            <div className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse delay-150"></div>
          </div>
          <span>{queueLength} queued</span>
        </>
      )}
    </div>
  );
}