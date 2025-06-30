/**
 * Message Input Component
 * Multi-type message input with text, audio, and media support
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import useChatStore from '@/stores/chatStore';
import useAuthStore from '@/stores/authStore';
import toast from 'react-hot-toast';
import { auth } from "@/lib/firebase/config"; // Add this import

export default function MessageInput({ onSendMessage, conversationId, characterId, disabled = false }) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const typingTimeoutRef = useRef(null);

  // Store hooks
  const { getCharacterUsage, sendTyping } = useChatStore();
  const { isPremium } = useAuthStore();

  // Get usage for this character
  const usage = getCharacterUsage(characterId);

  // Check if user can send messages
  const canSendText = isPremium || usage.text.used < usage.text.limit;
  const canSendImage = isPremium || usage.image.used < usage.image.limit;
  const canSendAudio = isPremium || usage.audio.used < usage.audio.limit;

  // Character count
  const maxLength = 1000;
  const remainingChars = maxLength - message.length;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [message]);

  // Define handleFileDrop before useDropzone
  const handleFileDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');

    // Check permissions
    if (isImage && !canSendImage) {
      toast.error('Image upload limit reached. Upgrade to premium for unlimited uploads.');
      return;
    }
    if (isAudio && !canSendAudio) {
      toast.error('Audio upload limit reached. Upgrade to premium for unlimited uploads.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Upload file
      const uploadedFile = await uploadFile(file);

      // Send message with file
      const messageType = isImage ? 'image' : 'audio';
      await onSendMessage(uploadedFile.url, messageType, {
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        ...uploadedFile
      });

      toast.success(`${isImage ? 'Image' : 'Audio'} sent successfully!`);
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const endpoint = file.type.startsWith('image/') ? '/media/upload/image' : '/media/upload/audio';

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setUploadProgress(100);

      return result;
    } finally {
      clearInterval(progressInterval);
    }
  };

  // Setup dropzone for file uploads - now handleFileDrop is defined
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1,
    onDrop: handleFileDrop,
    disabled: disabled || uploading,
    noClick: true,
    noKeyboard: true
  });

  const handleInputChange = (e) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setMessage(value);
      handleTypingIndicator(value.length > 0);
    }
  };

  const handleTypingIndicator = (isTyping) => {
    if (!conversationId) return;

    // Send typing indicator
    sendTyping(conversationId, isTyping);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(conversationId, false);
      }, 3000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleSendText = async () => {
    if (!message.trim() || disabled || !canSendText) return;

    const content = message.trim();
    setMessage('');

    // Stop typing indicator
    handleTypingIndicator(false);

    try {
      await onSendMessage(content, 'text');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      // Restore message on failure
      setMessage(content);
    }
  };

  const startRecording = async () => {
    if (!canSendAudio) {
      toast.error('Audio message limit reached. Upgrade to premium for unlimited messages.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'voice-message.wav', { type: 'audio/wav' });

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Upload and send
        await handleFileDrop([audioFile]);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Recording stopped');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Common emoji list
  const commonEmojis = ['😊', '😂', '❤️', '👍', '👎', '😢', '😮', '😡', '🤔', '👋'];

  return (
      <div className="p-3 sm:p-4">
        {/* Upload Progress */}
        {uploading && (
            <div className="mb-2 sm:mb-3">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
        )}

        {/* Drop Zone Overlay */}
        {isDragActive && (
            <div className="absolute inset-0 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center z-10">
              <div className="text-center">
                <div className="text-blue-500 text-3xl mb-2">📁</div>
                <p className="text-blue-700 font-medium">Drop your file here</p>
                <p className="text-blue-600 text-sm">Images and audio files supported</p>
              </div>
            </div>
        )}

        <div {...getRootProps()} className="relative">
          <input {...getInputProps()} />

          {/* Main Input Area */}
          <div className="space-y-2">
            {/* Text Input with integrated buttons */}
            <div className="relative flex items-end gap-1 sm:gap-2">
              <div className="flex-1 relative">
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder={disabled ? "Connecting..." : "Type a message..."}
                    disabled={disabled || !canSendText}
                    className={`w-full resize-none rounded-lg border px-3 py-2 pr-8 sm:pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] max-h-[120px] ${
                        !canSendText ? 'bg-gray-100 border-gray-300' : 'border-gray-300'
                    }`}
                    rows={1}
                />

                {/* Character Counter */}
                <div className={`absolute bottom-1 right-2 text-xs ${
                    remainingChars < 50 ? 'text-red-500' : 'text-gray-400'
                } hidden sm:block`}>
                  {remainingChars}
                </div>
              </div>

              {/* Send Button - Always visible on mobile */}
              <button
                  type="button"
                  onClick={handleSendText}
                  disabled={!message.trim() || disabled || !canSendText}
                  className={`p-2 sm:p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                      message.trim() && canSendText && !disabled
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                </svg>
              </button>
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Emoji Button */}
                <div className="relative">
                  <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 text-gray-500 hover:text-gray-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      disabled={disabled}
                  >
                    😊
                  </button>

                  {/* Simple Emoji Picker */}
                  {showEmojiPicker && (
                      <>
                        {/* Backdrop for mobile */}
                        <div 
                          className="sm:hidden fixed inset-0 z-40"
                          onClick={() => setShowEmojiPicker(false)}
                        />
                        
                        <div className="absolute bottom-full left-0 sm:right-0 mb-2 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                          <div className="grid grid-cols-5 gap-1">
                            {commonEmojis.map((emoji, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                      setMessage(prev => prev + emoji);
                                      setShowEmojiPicker(false);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded text-lg min-w-[36px] min-h-[36px]"
                                >
                                  {emoji}
                                </button>
                            ))}
                          </div>
                        </div>
                      </>
                  )}
                </div>

                {/* File Upload Button */}
                <button
                    type="button"
                    onClick={() => document.querySelector('input[type="file"]')?.click()}
                    className={`p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                        canSendImage ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'
                    }`}
                    disabled={disabled || (!canSendImage && !canSendAudio)}
                    title="Upload file"
                >
                  📎
                </button>

                {/* Voice Record Button */}
                <button
                    type="button"
                    onClick={toggleRecording}
                    className={`p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                        isRecording
                            ? 'text-red-500 animate-pulse'
                            : canSendAudio
                                ? 'text-gray-500 hover:text-gray-700'
                                : 'text-gray-300 cursor-not-allowed'
                    }`}
                    disabled={disabled || !canSendAudio}
                    title={isRecording ? "Stop recording" : "Record voice message"}
                >
                  🎤
                </button>
              </div>

              {/* Character counter on mobile */}
              {message.length > 0 && (
                <div className={`text-xs sm:hidden ${
                    remainingChars < 50 ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {remainingChars}
                </div>
              )}
            </div>
          </div>

          {/* Usage Warnings */}
          {!isPremium && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {!canSendText && (
                    <span className="text-red-600">Text messages: {usage.text.used}/{usage.text.limit}</span>
                )}
                {!canSendImage && (
                    <span className="text-red-600">Images: {usage.image.used}/{usage.image.limit}</span>
                )}
                {!canSendAudio && (
                    <span className="text-red-600">Audio: {usage.audio.used}/{usage.audio.limit}</span>
                )}
              </div>
          )}
        </div>
      </div>
  );
}