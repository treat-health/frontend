import { create } from 'zustand';
import toast from 'react-hot-toast';
import api, { axiosInstance } from '../lib/api';
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
    id: string;       // ConversationParticipant record ID
    userId: string;   // FK to User
    role: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
    };
    isMuted: boolean;
    mutedUntil?: string | null;
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
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentSize?: number;
    attachmentType?: string;
    sender: {
        id: string;
        firstName: string;
        lastName: string;
    };
    replyTo?: Message;
    // Client-side only optimistic fields
    tempId?: string;
    status?: 'uploading' | 'sent' | 'failed';
    previewUrl?: string; // local blob URL for images
}

/**
 * Admin Directory User
 */
export interface AdminUser {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    lastLoginAt?: string | null;
    createdAt: string;
}

export interface AdminUsersResult {
    users: AdminUser[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Module-scoped storage for pending File uploads.
 * Files cannot be serialized, so we keep them outside the Zustand state.
 */
const pendingUploads = new Map<string, File>();

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
    sendAttachmentOptimistically: (file: File, previewUrl: string | null, textContent: string, conversationId: string) => void;
    retryAttachmentUpload: (tempId: string) => void;
    cancelAttachmentUpload: (tempId: string) => void;
    fetchAdminUsers: (role: 'CLIENT' | 'THERAPIST', page?: number, search?: string) => Promise<AdminUsersResult | null>;
    _performAttachmentUpload: (file: File, tempMessage: Message) => Promise<void>;
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
     * Fetch users for admin directory
     */
    fetchAdminUsers: async (role: 'CLIENT' | 'THERAPIST', page = 1, search?: string) => {
        try {
            const response = await api.get<ApiResponse<AdminUsersResult>>('/chat/admin/users', {
                params: { role, page, limit: 20, search }
            });
            if (response.data.success && response.data.data) {
                return response.data.data;
            }
            return null;
        } catch (error) {
            console.error('[ChatStore] Failed to fetch admin users:', error);
            return null;
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
                const currentUser = useAuthStore.getState().user;
                const isMine = message.senderId === currentUser?.id;

                // Use a helper pure function to reduce nesting depth
                const updateStateForNewMessage = (state: ChatState) => {
                    const isCurrentConversation = state.currentConversation?.id === message.conversationId;
                    const shouldBumpUnread = !isCurrentConversation && !isMine;

                    let newMessages = state.messages;
                    if (isCurrentConversation) {
                        const exists = state.messages.some(m => m.id === message.id);
                        if (!exists) {
                            newMessages = [...state.messages, message as Message];
                        }
                    }

                    const newConversations = state.conversations.map((conv) => {
                        if (conv.id !== message.conversationId) return conv;

                        const newParticipants = conv.participants.map((p) => {
                            const isMe = p.userId === currentUser?.id || p.user?.id === currentUser?.id;
                            if (isMe && shouldBumpUnread) {
                                return { ...p, unreadCount: (p.unreadCount || 0) + 1 };
                            }
                            return p;
                        });

                        return {
                            ...conv,
                            lastMessage: message,
                            participants: newParticipants,
                        };
                    });

                    return {
                        messages: newMessages,
                        conversations: newConversations,
                        totalUnread: shouldBumpUnread ? state.totalUnread + 1 : state.totalUnread,
                    };
                };

                set(updateStateForNewMessage);

                // Toast notification (outside of set() to avoid side-effects in updater)
                const isCurrentConv = get().currentConversation?.id === message.conversationId;

                // Mute suppression logic
                const targetConv = get().conversations.find((c) => c.id === message.conversationId);
                let isMuted = false;
                if (targetConv && currentUser) {
                    const myParticipant = targetConv.participants.find(p => p.userId === currentUser.id || p.user?.id === currentUser.id);
                    if (myParticipant) {
                        isMuted = Boolean(myParticipant.isMuted) || (Boolean(myParticipant.mutedUntil) && new Date(myParticipant.mutedUntil!) > new Date());
                    }
                }

                if (!isCurrentConv && !isMine && !isMuted) {
                    toast(`${message.sender?.firstName || 'Someone'} sent you a message`, {
                        icon: '💬',
                        position: 'top-right'
                    });
                }
            },
            onMessageSent: ({ messageId, tempId }) => {
                set((state) => ({
                    isSending: false,
                    // Replace the temp ID with the real server ID,
                    // and also deduplicate in case message:new arrived first
                    messages: state.messages
                        .map((m) => m.id === tempId ? { ...m, id: messageId } : m)
                        .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i),
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
            onConversationRead: ({ conversationId, userId }: ReadReceiptEvent) => {
                // Update UI to show read status (clear unread badge for the specific user)
                set((state) => ({
                    conversations: state.conversations.map(c =>
                        c.id === conversationId
                            ? { ...c, participants: c.participants.map(p => p.userId === userId ? { ...p, unreadCount: 0 } : p) }
                            : c
                    )
                }));
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
            onConversationDeactivated: ({ conversationId }) => {
                const wasCurrent = get().currentConversation?.id === conversationId;
                set((state) => ({
                    conversations: state.conversations.filter(c => c.id !== conversationId),
                    currentConversation: wasCurrent ? null : state.currentConversation,
                    messages: wasCurrent ? [] : state.messages,
                }));
                if (wasCurrent) {
                    toast('Conversation closed by admin', { icon: '🔒', duration: 4000 });
                }
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
    fetchMessages: async (conversationId: string, beforeMessageId?: string) => {
        set({ isLoadingMessages: true, error: null });
        try {
            const params = beforeMessageId ? `?before=${beforeMessageId}` : '';
            const response = await api.get<ApiResponse<{ messages: Message[] }>>(
                `/chat/conversations/${conversationId}/messages${params}`
            );
            if (response.data.success && response.data.data) {
                const newMessages = response.data.data.messages;
                if (beforeMessageId) {
                    // Prepend older messages (backward pagination)
                    set({ messages: [...newMessages, ...get().messages], isLoadingMessages: false });
                } else {
                    // Replace messages (initial load)
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

        // Leave previous conversation room and clear stale typing indicators
        if (state.currentConversation) {
            leaveConversation(state.currentConversation.id);
            const typingUsers = new Map(state.typingUsers);
            typingUsers.delete(state.currentConversation.id);
            set({ typingUsers });
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
                set((state) => {
                    const exists = state.conversations.some(c => c.id === conversation.id);
                    return {
                        conversations: exists ? state.conversations : [conversation, ...state.conversations],
                        isLoading: false,
                    };
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
                set((state) => {
                    const exists = state.conversations.some(c => c.id === conversation.id);
                    return {
                        conversations: exists ? state.conversations : [conversation, ...state.conversations],
                        isLoading: false,
                    };
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
     * Helper to perform the actual upload and socket send
     */
    _performAttachmentUpload: async (file: File, tempMessage: Message) => {
        const { id: tempId, conversationId } = tempMessage;
        try {
            // 1. Get Presigned URL
            const res = await api.get<ApiResponse<{ uploadUrl: string, fileUrl: string, key: string }>>('/chat/attachments/presigned-url', {
                params: {
                    fileName: file.name,
                    contentType: file.type,
                }
            });

            if (!res.data.success || !res.data.data) {
                throw new Error('Failed to generate upload URL');
            }

            const { uploadUrl, fileUrl } = res.data.data;

            // 2. Upload directly to S3 Bucket
            await axiosInstance.put(uploadUrl, file, {
                headers: {
                    'Content-Type': file.type,
                }
            });

            // 3. Update local message status to sent
            set((state) => ({
                messages: state.messages.map(msg =>
                    msg.id === tempId
                        ? { ...msg, status: 'sent', attachmentUrl: fileUrl }
                        : msg
                )
            }));

            // 4. Send the actual socket message
            const cType = file.type.startsWith('image/') ? 'IMAGE' : 'FILE';
            socketSendMessage({
                conversationId,
                content: tempMessage.content || 'Attachment',
                contentType: cType,
                attachmentUrl: fileUrl,
                attachmentName: file.name,
                attachmentSize: file.size,
                attachmentType: file.type,
                tempId // Pass tempId so backend and other clients can reconcile
            });

            // 5. Cleanup memory map on success
            pendingUploads.delete(tempId);

        } catch (error) {
            console.error('Attachment upload failed:', error);
            // Mark as failed
            set((state) => ({
                messages: state.messages.map(msg =>
                    msg.id === tempId
                        ? { ...msg, status: 'failed' }
                        : msg
                )
            }));
        }
    },

    /**
     * WhatsApp-style optimistic attachment upload
     */
    sendAttachmentOptimistically: (file: File, previewUrl: string | null, textContent: string, conversationId: string) => {
        const authStore = useAuthStore.getState();
        if (!authStore.user) return;

        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const cType = file.type.startsWith('image/') ? 'IMAGE' : 'FILE';

        // 1. Create optimistic message
        const optimisticMessage: Message = {
            id: tempId,
            conversationId,
            senderId: authStore.user.id,
            content: textContent.trim() || 'Attachment',
            contentType: cType,
            isEdited: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            status: 'uploading',
            tempId,
            previewUrl: previewUrl || undefined,
            attachmentName: file.name,
            attachmentSize: file.size,
            attachmentType: file.type,
            sender: {
                id: authStore.user.id,
                firstName: authStore.user.firstName || 'You',
                lastName: authStore.user.lastName || '',
            }
        };

        // 2. Insert into UI immediately
        set((state) => {
            if (state.currentConversation?.id !== conversationId) return state;
            return {
                messages: [...state.messages, optimisticMessage]
            };
        });

        // 3. Start background upload
        const store = get();

        // Store the file reference in outer map so retry works without polluting state
        pendingUploads.set(tempId, file);
        store._performAttachmentUpload(file, optimisticMessage);
    },

    /**
     * Retry a failed upload
     */
    retryAttachmentUpload: (tempId: string) => {
        const state = get();
        const msg = state.messages.find(m => m.id === tempId);
        const file = pendingUploads.get(tempId);

        if (!msg || msg.status !== 'failed' || !file) return;

        // Reset status to uploading
        set((state) => ({
            messages: state.messages.map(m =>
                m.id === tempId ? { ...m, status: 'uploading' } : m
            )
        }));

        const store = get();
        store._performAttachmentUpload(file, msg);
    },

    /**
     * Cancel/Remove a failed upload
     */
    cancelAttachmentUpload: (tempId: string) => {
        pendingUploads.delete(tempId);
        set((state) => ({
            messages: state.messages.filter(m => m.id !== tempId)
        }));
    },

    /**
     * Send a standard text message
     */
    sendMessage: (content: string, replyToId?: string) => {
        const state = get();
        const conversation = state.currentConversation;
        const currentUser = useAuthStore.getState().user;
        if (!conversation || !content.trim() || !currentUser) return;

        // Client-side content length validation
        if (content.trim().length > 5000) {
            toast.error('Message is too long (max 5,000 characters)');
            return;
        }

        // Create optimistic message
        const msgId = `temp-${Date.now()}`; // Always generate a tempId for optimistic updates

        const optimisticMessage: Message = {
            id: msgId,
            conversationId: conversation.id,
            senderId: currentUser.id,
            content: content.trim(),
            contentType: 'TEXT',
            isEdited: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            replyToId,
            replyTo: replyToId ? state.messages.find(m => m.id === replyToId) : undefined,
            tempId: msgId, // Always set tempId for optimistic messages
            sender: {
                id: currentUser.id,
                firstName: currentUser.firstName || 'You',
                lastName: currentUser.lastName || '',
            },
        };

        // Add to state immediately
        set((state) => ({
            isSending: true,
            messages: [...state.messages, optimisticMessage],
        }));

        // Use standard tempId to avoid duplicate inserts on the socket round trip
        try {
            socketSendMessage({
                conversationId: conversation.id,
                content: content.trim(),
                contentType: 'TEXT',
                replyToId,
                tempId: msgId,
            });
        } catch (error) {
            console.error('Failed to send text message over socket', error);
            // Optionally handle text message failure here
            set((state) => ({
                isSending: false,
                messages: state.messages.filter(m => m.id !== msgId),
            }));
            toast.error('Failed to send message over socket');
        }

        // Fallback: if server never acknowledges, refetch to reconcile
        const convId = conversation.id;
        setTimeout(() => {
            const state = get();
            const stillTemp = state.messages.find(m => m.id === msgId);
            if (stillTemp) {
                get().fetchMessages(convId);
            }
        }, 10000);
    },

    /**
     * Mark current conversation as read
     */
    markAsRead: async () => {
        const conversation = get().currentConversation;
        const currentUser = useAuthStore.getState().user;
        if (!conversation || !currentUser) return;

        // Optimistically clear unread count for the current conversation (ONLY for current user)
        set({
            conversations: get().conversations.map(c =>
                c.id === conversation.id
                    ? {
                        ...c,
                        participants: c.participants.map(p =>
                            p.userId === currentUser.id ? { ...p, unreadCount: 0 } : p
                        )
                    }
                    : c
            ),
        });

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
