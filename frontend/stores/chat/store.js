/**
 * Main Chat Store
 * Combines all chat-related slices into a single store
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createSocketSlice } from './slices/socketSlice';
import { createMessageSlice } from './slices/messageSlice';
import { createMessageLikesSlice } from './slices/messageLikesSlice';
import { createConversationSlice } from './slices/conversationSlice';
import { createConversationMessagesSlice } from './slices/conversationMessagesSlice';
import { createQueueSlice } from './slices/queueSlice';
import { createUsageSlice } from './slices/usageSlice';
import { createTypingSlice } from './slices/typingSlice';

const useChatStore = create(
    subscribeWithSelector((set, get, api) => ({
        // Combine all slices
        ...createSocketSlice(set, get, api),
        ...createMessageSlice(set, get, api),
        ...createMessageLikesSlice(set, get, api),
        ...createConversationSlice(set, get, api),
        ...createConversationMessagesSlice(set, get, api),
        ...createQueueSlice(set, get, api),
        ...createUsageSlice(set, get, api),
        ...createTypingSlice(set, get, api),
    }))
);

export default useChatStore;