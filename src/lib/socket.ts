import { io, Socket } from 'socket.io-client';
import { tokenStorage } from './api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket: Socket | null = null;

/**
 * Socket event types
 */
export interface MessageData {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    contentType: 'TEXT' | 'FILE' | 'IMAGE';
    replyToId?: string;
    createdAt: string;
    sender: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

export interface TypingEvent {
    conversationId: string;
    userId: string;
}

export interface ReadReceiptEvent {
    conversationId: string;
    userId: string;
    readAt: string;
}

export interface UserStatusEvent {
    userId: string;
}

/**
 * Socket event handlers type
 */
export interface SocketEventHandlers {
    onMessageNew?: (message: MessageData) => void;
    onMessageSent?: (data: { messageId: string; tempId: string }) => void;
    onMessageError?: (data: { error: string, tempId?: string }) => void;
    onMessageEdited?: (message: MessageData) => void;
    onMessageDeleted?: (data: { messageId: string }) => void;
    onConversationRead?: (data: ReadReceiptEvent) => void;
    onTypingStart?: (data: TypingEvent) => void;
    onTypingStop?: (data: TypingEvent) => void;
    onUserOnline?: (data: UserStatusEvent) => void;
    onUserOffline?: (data: UserStatusEvent) => void;
    onUsersOnlineList?: (userIds: string[]) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
}

let eventHandlers: SocketEventHandlers = {};

/**
 * Initialize socket connection with JWT auth
 */
export function connectSocket(handlers?: SocketEventHandlers): Socket | null {
    const token = tokenStorage.getAccessToken();

    if (!token) {
        console.warn('[Socket] No auth token available');
        return null;
    }

    if (socket) {
        console.log('[Socket] Instance exists');
        if (handlers) {
            updateSocketHandlers(handlers);
        }
        if (!socket.connected) {
            socket.auth = { token };
            socket.connect();
        }
        return socket;
    }

    // Store handlers
    if (handlers) {
        eventHandlers = { ...eventHandlers, ...handlers };
    }

    // Create socket connection
    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    // Connection events
    socket.on('connect', () => {
        console.log('[Socket] Connected');
        eventHandlers.onConnect?.();
    });

    socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
        eventHandlers.onDisconnect?.();
    });

    socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
        eventHandlers.onError?.(error);
    });

    // Message events
    socket.on('message:new', (message: MessageData) => {
        eventHandlers.onMessageNew?.(message);
    });

    socket.on('message:sent', (data: { messageId: string; tempId: string }) => {
        eventHandlers.onMessageSent?.(data);
    });

    socket.on('message:error', (data: { error: string; tempId?: string }) => {
        eventHandlers.onMessageError?.(data);
    });

    socket.on('message:edited', (message: MessageData) => {
        eventHandlers.onMessageEdited?.(message);
    });

    socket.on('message:deleted', (data: { messageId: string }) => {
        eventHandlers.onMessageDeleted?.(data);
    });

    // Typing events
    socket.on('typing:start', (data: TypingEvent) => {
        eventHandlers.onTypingStart?.(data);
    });

    socket.on('typing:stop', (data: TypingEvent) => {
        eventHandlers.onTypingStop?.(data);
    });

    // Read receipt events
    socket.on('conversation:read', (data: ReadReceiptEvent) => {
        eventHandlers.onConversationRead?.(data);
    });

    // User status events
    socket.on('user:online', (data: UserStatusEvent) => {
        eventHandlers.onUserOnline?.(data);
    });

    socket.on('user:offline', (data: UserStatusEvent) => {
        eventHandlers.onUserOffline?.(data);
    });

    socket.on('users:online:list', (userIds: string[]) => {
        eventHandlers.onUsersOnlineList?.(userIds);
    });

    return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

/**
 * Get current socket instance
 */
export function getSocket(): Socket | null {
    return socket;
}

/**
 * Check if socket is connected
 */
export function isSocketConnected(): boolean {
    return socket?.connected ?? false;
}

/**
 * Join a conversation room
 */
export function joinConversation(conversationId: string): void {
    socket?.emit('conversation:join', conversationId);
}

/**
 * Leave a conversation room
 */
export function leaveConversation(conversationId: string): void {
    socket?.emit('conversation:leave', conversationId);
}

/**
 * Send a message
 */
export function sendMessage(data: {
    conversationId: string;
    content: string;
    contentType?: 'TEXT' | 'FILE' | 'IMAGE';
    replyToId?: string;
    tempId?: string;
}): void {
    socket?.emit('message:send', {
        conversationId: data.conversationId,
        content: data.content,
        contentType: data.contentType || 'TEXT',
        replyToId: data.replyToId,
        tempId: data.tempId,
    });
}

/**
 * Edit a message
 */
export function editMessage(messageId: string, content: string): void {
    socket?.emit('message:edit', { messageId, content });
}

/**
 * Delete a message
 */
export function deleteMessage(messageId: string, conversationId: string): void {
    socket?.emit('message:delete', { messageId, conversationId });
}

/**
 * Mark conversation as read
 */
export function markConversationRead(conversationId: string): void {
    socket?.emit('conversation:read', conversationId);
}

/**
 * Start typing indicator
 */
export function startTyping(conversationId: string): void {
    socket?.emit('typing:start', conversationId);
}

/**
 * Stop typing indicator
 */
export function stopTyping(conversationId: string): void {
    socket?.emit('typing:stop', conversationId);
}

/**
 * Query user presence
 */
export function queryPresence(userIds: string[]): void {
    socket?.emit('presence:query', userIds);
}

/**
 * Update event handlers
 */
export function updateSocketHandlers(handlers: Partial<SocketEventHandlers>): void {
    eventHandlers = { ...eventHandlers, ...handlers };
}
