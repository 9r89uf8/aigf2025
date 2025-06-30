/**
 * Chat Interface Component
 * Main chat interface with message list and input
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import useChatStore from '@/stores/chatStore';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import QueueStatus from './QueueStatus';
import useAuthStore from '@/stores/authStore';

export default function ChatInterface({ character, conversationId, characterId, className = '' }) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Store hooks
  const { user } = useAuthStore();
  const {
    getMessages,
    getTypingUsers,
    loadMessages,
    sendMessage,
    retryMessage,
    failedMessages,
    likeMessage,
    isMessageLiked,
    likedMessages,
    getQueueStatus,
    getMessageRelationship,
    isMessageProcessing,
    hasLLMError
  } = useChatStore();

  // Get messages and typing users for current conversation
  const messages = getMessages(conversationId);
  const typingUsers = getTypingUsers(conversationId);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    scrollToBottom();
  }, [messages.length]);

  useEffect(() => {
    // Load initial messages when conversation changes
    if (conversationId) {
      loadInitialMessages();
    }
  }, [conversationId]);

  // Handle keyboard visibility on mobile
  useEffect(() => {
    const handleResize = () => {
      // Check if keyboard is likely visible on mobile
      if (window.visualViewport) {
        const hasKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
        setIsKeyboardVisible(hasKeyboard);
        
        // Scroll to bottom when keyboard appears
        if (hasKeyboard) {
          setTimeout(() => scrollToBottom(), 100);
        }
      }
    };

    // Add event listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadInitialMessages = async () => {
    if (!conversationId) return;
    
    setIsLoadingMore(true);
    try {
      const loadedMessages = await loadMessages(conversationId);
      // If loadMessages returns undefined/null or empty array, no more messages to load
      setHasMoreMessages(loadedMessages && loadedMessages.length === 50);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setHasMoreMessages(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || !conversationId) return;

    setIsLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      const beforeTimestamp = oldestMessage ? oldestMessage.timestamp : null;
      
      const loadedMessages = await loadMessages(conversationId, 20, beforeTimestamp);
      
      if (!loadedMessages || loadedMessages.length < 20) {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Load more messages when scrolled near top
    if (container.scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  };

  const handleSendMessage = async (content, type = 'text', metadata = {}) => {
    if (!conversationId) return;

    try {
      await sendMessage(conversationId, content, type, metadata);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleRetryMessage = (messageId) => {
    retryMessage(messageId, conversationId);
  };

  const handleLikeMessage = async (messageId, isLiked) => {
    await likeMessage(messageId, isLiked);
  };

  const isMessageFailed = (messageId) => {
    return failedMessages.has(messageId);
  };

  const isCurrentUser = (senderId) => {
    return senderId === user?.uid || senderId === 'user';
  };

  const countUnrespondedUserMessages = (messages, currentIndex) => {
    // Count user messages from the last AI message (or start) up to current AI message
    let count = 0;
    
    // Look backwards from current message to find unresponded user messages
    for (let i = currentIndex - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgIsFromUser = isCurrentUser(msg.sender || msg.senderId);
      
      if (msgIsFromUser) {
        count++;
      } else {
        // Found an AI message, stop counting (these user messages were already responded to)
        break;
      }
    }
    
    return count;
  };

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4"
        style={{ paddingBottom: isKeyboardVisible ? '20px' : undefined }}
      >
        {/* Load More Indicator */}
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* No Messages State */}
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <img
                src={character.avatar || '/default-avatar.png'}
                alt={character.name}
                className="w-16 h-16 rounded-full mx-auto mb-4 object-cover"
              />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Start chatting with {character.name}
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                {character.description || 'Say hello to begin your conversation!'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {character.traits && character.traits.slice(0, 3).map((trait, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages List */}
        {messages.map((message, index) => {
          const isOwn = isCurrentUser(message.sender || message.senderId);
          const isFailed = isMessageFailed(message.id);
          const showAvatar = !isOwn && (
            index === 0 || 
            !isCurrentUser(messages[index - 1]?.sender || messages[index - 1]?.senderId)
          );

          const messageIsLiked = likedMessages.includes(message.id);
          const messageHasLLMError = hasLLMError(message.id);
          
          // Get queue and relationship info
          // Use replyToMessageId from message data (for page loads) or relationship map (for real-time)
          const replyToMessageId = message.replyToMessageId || getMessageRelationship(message.id);
          const replyToMessage = replyToMessageId ? messages.find(m => m.id === replyToMessageId) : null;
          const messageIsProcessing = isMessageProcessing(message.id, conversationId);
          
          // Count unresponded user messages before current AI message to determine if we should show "replying to:"
          const shouldShowReplyTo = !isOwn && replyToMessage ? 
            countUnrespondedUserMessages(messages, index) > 1 : false;

          
          return (
            <MessageBubble
              key={message.id}
              message={message}
              character={character}
              isOwn={isOwn}
              isFailed={isFailed}
              hasLLMError={messageHasLLMError}
              showAvatar={showAvatar}
              onRetry={() => handleRetryMessage(message.id)}
              onLike={handleLikeMessage}
              isLiked={messageIsLiked}
              replyToMessage={replyToMessage}
              shouldShowReplyTo={shouldShowReplyTo}
              retryCount={message.retryCount || 0}
              maxRetries={3}
            />
          );
        })}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator
            users={typingUsers}
            character={character}
          />
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Queue Status */}
      <QueueStatus conversationId={conversationId} />

      {/* Message Input */}
      <div className="border-t border-gray-200 bg-white">
        <MessageInput
          onSendMessage={handleSendMessage}
          conversationId={conversationId}
          characterId={characterId}
          disabled={!conversationId}
        />
      </div>
    </div>
  );
}