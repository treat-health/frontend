import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from './authStore';
import type { ApiResponse } from '../lib/api';
import {
    connectSocket,
    disconnectSocket,
    joinConversation,
    leaveConversation,
    sendMessage as socketSendMessage,
    markConversationRead as socketMarkRead,
    startTyping as socketStartTyping,
    stopTyping as socketStopTyping,
    isSocketConnected,
} from '../lib/socket';
import type { MessageData, TypingEvent, ReadReceiptEvent, UserStatusEvent } from '../lib/socket';

/**
 * Conversation types
 */
export interface Participant {
    id: string;
    participantId: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
    };
    isMuted: boolean;
    unreadCount: number;
}

export interface Conversation {
    id: string;
    type: 'DIRECT' | 'GROUP';
    name?: string;
    participants: Participant[];
    lastMessage?: MessageData;
    createdAt: string;
    updatedAt: string;
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    contentType: 'TEXT' | 'FILE' | 'IMAGE';
    replyToId?: string;
    isEdited: boolean;
    isDeleted: boolean;
    createdAt: string;
    sender: {
        id: string;
        firstName: string;
        lastName: string;
    };
    replyTo?: Message;
}

/**
 * Chat store state
 */
interface ChatState {
    // State
    conversations: Conversation[];
    currentConversation: Conversation | null;
    messages: Message[];
    typingUsers: Map<string, Set<string>>; // conversationId -> Set of userIds
    onlineUsers: Set<string>;
    isLoading: boolean;
    isLoadingMessages: boolean;
    isSending: boolean;
    error: string | null;
    isConnected: boolean;
    totalUnread: number;

    // Actions
    initializeSocket: () => void;
    disconnectChat: () => void;
    fetchConversations: () => Promise<void>;
    fetchMessages: (conversationId: string, cursor?: string) => Promise<void>;
    selectConversation: (conversationId: string) => Promise<void>;
    createDirectConversation: (userId: string) => Promise<Conversation>;
    createGroupConversation: (name: string, participantIds: string[]) => Promise<Conversation>;
    sendMessage: (content: string, replyToId?: string) => void;
    markAsRead: () => Promise<void>;
    startTyping: () => void;
    stopTyping: () => void;
    clearChat: () => void;
    fetchUnreadMessagesCount: () => Promise<void>;
}

/**
 * Chat store
 */
export const useChatStore = create<ChatState>()((set, get) => ({
    // Initial state
    conversations: [],
    currentConversation: null,
    messages: [],
    typingUsers: new Map(),
    onlineUsers: new Set(),
    isLoading: false,
    isLoadingMessages: false,
    isSending: false,
    error: null,
    isConnected: false,
    totalUnread: 0,
    fetchUnreadMessagesCount: async () => {
        try {
            const response = await api.get<ApiResponse<{ count: number }>>('/chat/unread');
            if (response.data.success && response.data.data) {
                set({ totalUnread: response.data.data.count });
            }
        } catch (error) {
            console.error('[ChatStore] Failed to fetch unread count:', error);
        }
    },

    /**
     * Initialize socket connection with event handlers
     */
    initializeSocket: () => {
        if (isSocketConnected()) return;

        connectSocket({
            onConnect: () => {
                set({ isConnected: true, error: null });
                // Rejoin current conversation if any and refresh data
                const current = get().currentConversation;
                if (current) {
                    joinConversation(current.id);
                    get().fetchMessages(current.id);
                }

                // Refresh conversations and unread count on reconnect
                get().fetchConversations();
                get().fetchUnreadMessagesCount();
            },
            onDisconnect: () => {
                set({ isConnected: false });
            },
            onMessageNew: (message: MessageData) => {
                const state = get();
                const isCurrentConversation = state.currentConversation?.id === message.conversationId;

                // Add message to current conversation
                if (isCurrentConversation) {
                    set({ messages: [...state.messages, message as Message] });
                }

                // Update conversation's last message
                set({
                    conversations: state.conversations.map((conv) =>
                        conv.id === message.conversationId
                            ? { ...conv, lastMessage: message, updatedAt: message.createdAt }
                            : conv
                    ),
                });

                // Update unread count if not current conversation AND message is from someone else
                const currentUser = useAuthStore.getState().user;
                if (!isCurrentConversation && message.senderId !== currentUser?.id) {
                    set({ totalUnread: state.totalUnread + 1 });

                    toast(`${message.sender?.firstName || 'Someone'} sent you a message`, {
                        icon: '💬',
                        position: 'top-right'
                    });
                }
            },
            onMessageSent: ({ messageId, tempId }) => {
                set((state) => ({
                    isSending: false,
                    messages: state.messages.map((m) =>
                        m.id === tempId ? { ...m, id: messageId } : m
                    ),
                }));
            },
            onMessageError: ({ error, tempId }) => {
                set((state) => ({
                    isSending: false,
                    error,
                    messages: tempId ? state.messages.filter((m) => m.id !== tempId) : state.messages
                }));
                toast.error(error || 'Failed to send message');
            },
            onMessageEdited: (message: MessageData) => {
                set({
                    messages: get().messages.map((m) =>
                        m.id === message.id ? { ...m, content: message.content, isEdited: true } : m
                    ),
                });
            },
            onMessageDeleted: ({ messageId }) => {
                set({
                    messages: get().messages.map((m) =>
                        m.id === messageId ? { ...m, isDeleted: true, content: 'Message deleted' } : m
                    ),
                });
            },
            onTypingStart: ({ conversationId, userId }: TypingEvent) => {
                const typingUsers = new Map(get().typingUsers);
                const users = typingUsers.get(conversationId) || new Set();
                users.add(userId);
                typingUsers.set(conversationId, users);
                set({ typingUsers });
            },
            onTypingStop: ({ conversationId, userId }: TypingEvent) => {
                const typingUsers = new Map(get().typingUsers);
                const users = typingUsers.get(conversationId);
                if (users) {
                    users.delete(userId);
                    if (users.size === 0) {
                        typingUsers.delete(conversationId);
                    } else {
                        typingUsers.set(conversationId, users);
                    }
                    set({ typingUsers });
                }
            },
            onConversationRead: ({ conversationId }: ReadReceiptEvent) => {
                // Update UI to show read status
                const current = get().currentConversation;
                if (current?.id === conversationId) {
                    // Messages marked as read by other user
                }
            },
            onUserOnline: ({ userId }: UserStatusEvent) => {
                const onlineUsers = new Set(get().onlineUsers);
                onlineUsers.add(userId);
                set({ onlineUsers });
            },
            onUserOffline: ({ userId }: UserStatusEvent) => {
                const onlineUsers = new Set(get().onlineUsers);
                onlineUsers.delete(userId);
                set({ onlineUsers });
            },
            onUsersOnlineList: (userIds: string[]) => {
                set({ onlineUsers: new Set(userIds) });
            },
            onError: (error) => {
                set({ error: error.message });
            },
        });
    },

    /**
     * Disconnect socket
     */
    disconnectChat: () => {
        disconnectSocket();
        set({ isConnected: false });
    },

    /**
     * Fetch user's conversations
     */
    fetchConversations: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get<ApiResponse<{ conversations: Conversation[] }>>('/chat/conversations');
            if (response.data.success && response.data.data) {
                set({ conversations: response.data.data.conversations, isLoading: false });
                get().fetchUnreadMessagesCount();
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch conversations';
            set({ error: message, isLoading: false });
        }
    },

    /**
     * Fetch messages for a conversation
     */
    fetchMessages: async (conversationId: string, cursor?: string) => {
        set({ isLoadingMessages: true, error: null });
        try {
            const params = cursor ? `?cursor=${cursor}` : '';
            const response = await api.get<ApiResponse<{ messages: Message[] }>>(
                `/chat/conversations/${conversationId}/messages${params}`
            );
            if (response.data.success && response.data.data) {
                const newMessages = response.data.data.messages;
                if (cursor) {
                    // Append to existing messages (pagination)
                    set({ messages: [...newMessages, ...get().messages], isLoadingMessages: false });
                } else {
                    // Replace messages
                    set({ messages: newMessages, isLoadingMessages: false });
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch messages';
            set({ error: message, isLoadingMessages: false });
        }
    },

    /**
     * Select a conversation and load its messages
     */
    selectConversation: async (conversationId: string) => {
        const state = get();

        // Leave previous conversation room
        if (state.currentConversation) {
            leaveConversation(state.currentConversation.id);
        }

        // Find and set current conversation
        const conversation = state.conversations.find((c) => c.id === conversationId);
        if (conversation) {
            set({ currentConversation: conversation, messages: [] });

            // Join new conversation room
            joinConversation(conversationId);

            // Fetch messages
            await get().fetchMessages(conversationId);

            // Mark as read
            await get().markAsRead();
        }
    },

    /**
     * Create a direct (1:1) conversation
     */
    createDirectConversation: async (userId: string): Promise<Conversation> => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post<ApiResponse<Conversation>>('/chat/conversations/direct', {
                userId: userId,
            });
            if (response.data.success && response.data.data) {
                const conversation = response.data.data;
                set({
                    conversations: [conversation, ...get().conversations],
                    isLoading: false,
                });
                return conversation;
            }
            throw new Error('Failed to create conversation');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to create conversation';
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    /**
     * Create a group conversation
     */
    createGroupConversation: async (name: string, participantIds: string[]): Promise<Conversation> => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post<ApiResponse<Conversation>>('/chat/conversations/group', {
                name,
                participantIds,
            });
            if (response.data.success && response.data.data) {
                const conversation = response.data.data;
                set({
                    conversations: [conversation, ...get().conversations],
                    isLoading: false,
                });
                return conversation;
            }
            throw new Error('Failed to create group');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to create group';
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    /**
     * Send a message via socket
     */
    sendMessage: (content: string, replyToId?: string) => {
        const conversation = get().currentConversation;
        const currentUser = useAuthStore.getState().user;
        if (!conversation || !content.trim() || !currentUser) return;

        const tempId = `temp-${Date.now()}`;

        // Optimistic UI update
        const tempMessage: Message = {
            id: tempId,
            conversationId: conversation.id,
            senderId: currentUser.id,
            content: content.trim(),
            contentType: 'TEXT',
            replyToId,
            isEdited: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            sender: {
                id: currentUser.id,
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
            }
        };

        set((state) => ({
            isSending: true,
            messages: [...state.messages, tempMessage]
        }));

        socketSendMessage({
            conversationId: conversation.id,
            content: content.trim(),
            replyToId,
            tempId
        });
    },

    /**
     * Mark current conversation as read
     */
    markAsRead: async () => {
        const conversation = get().currentConversation;
        if (!conversation) return;

        try {
            socketMarkRead(conversation.id);
            await api.post(`/chat/conversations/${conversation.id}/read`);

            // Re-fetch the global unread count to sync the sidebar badge
            get().fetchUnreadMessagesCount();
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    },

    /**
     * Send typing start indicator
     */
    startTyping: () => {
        const conversation = get().currentConversation;
        if (conversation) {
            socketStartTyping(conversation.id);
        }
    },

    /**
     * Send typing stop indicator
     */
    stopTyping: () => {
        const conversation = get().currentConversation;
        if (conversation) {
            socketStopTyping(conversation.id);
        }
    },

    /**
     * Clear chat state
     */
    clearChat: () => {
        const current = get().currentConversation;
        if (current) {
            leaveConversation(current.id);
        }
        set({
            currentConversation: null,
            messages: [],
            typingUsers: new Map(),
        });
    },
}));

export default useChatStore;
