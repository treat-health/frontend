import { useEffect, useState, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { MessageSquare, Send, Search, Plus, MoreVertical, Phone, Video, X } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import '../../styles/chat.css';
import NewChatModal from './NewChatModal';

/**
 * Format time for display
 */
function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

/**
 * Get initials from name
 */
function getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Messages Page Component
 */
export default function MessagesPage() {
    const { user } = useAuthStore();
    const {
        conversations,
        currentConversation,
        messages,
        typingUsers,
        onlineUsers,
        isLoading,
        isConnected,
        initializeSocket,
        fetchConversations,
        selectConversation,
        sendMessage,
        startTyping,
        stopTyping,
        clearChat,
    } = useChatStore();

    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initialize socket and fetch conversations
    useEffect(() => {
        initializeSocket();
        fetchConversations();
    }, [initializeSocket, fetchConversations]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle typing indicator
    const handleInputChange = useCallback((value: string) => {
        setMessageInput(value);

        if (value.trim()) {
            startTyping();
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
                stopTyping();
            }, 2000);
        } else {
            stopTyping();
        }
    }, [startTyping, stopTyping]);

    // Send message
    const handleSendMessage = useCallback(() => {
        if (!messageInput.trim()) return;
        sendMessage(messageInput.trim());
        setMessageInput('');
        stopTyping();
    }, [messageInput, sendMessage, stopTyping]);

    // Handle key press
    const handleKeyPress = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    // Get conversation display name
    const getConversationName = (conv: typeof conversations[0]) => {
        if (conv.type === 'GROUP' && conv.name) {
            return conv.name;
        }
        const otherParticipant = conv.participants.find(
            (p) => p.user.id !== user?.id
        );
        if (otherParticipant) {
            return `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`;
        }
        return 'Unknown';
    };

    // Get conversation avatar initials
    const getConversationInitials = (conv: typeof conversations[0]) => {
        if (conv.type === 'GROUP' && conv.name) {
            return conv.name.substring(0, 2).toUpperCase();
        }
        const otherParticipant = conv.participants.find(
            (p) => p.user.id !== user?.id
        );
        if (otherParticipant) {
            return getInitials(otherParticipant.user.firstName, otherParticipant.user.lastName);
        }
        return '??';
    };

    // Check if other user is online
    const isUserOnline = (conv: typeof conversations[0]) => {
        if (conv.type === 'GROUP') return false;
        const otherParticipant = conv.participants.find(
            (p) => p.user.id !== user?.id
        );
        return otherParticipant ? onlineUsers.has(otherParticipant.user.id) : false;
    };

    // Get typing users for current conversation
    const currentTypingUsers = currentConversation
        ? typingUsers.get(currentConversation.id) || new Set()
        : new Set();

    // Filter conversations
    const filteredConversations = conversations.filter((conv) =>
        getConversationName(conv).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="chat-layout">
            <aside className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <h2>Messages</h2>
                    <button
                        className="btn btn-icon btn-ghost"
                        onClick={() => setShowNewChatModal(true)}
                        title="New Message"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="chat-search">
                    <div style={{ position: 'relative' }}>
                        <Search
                            size={16}
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--gray-400)',
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '36px' }}
                        />
                    </div>
                </div>

                <div className="conversation-list">
                    {isLoading ? (
                        <div className="flex justify-center items-center" style={{ padding: '2rem' }}>
                            <div className="spinner spinner-dark" />
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                            No conversations yet
                        </div>
                    ) : (
                        filteredConversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
                                onClick={() => selectConversation(conv.id)}
                            >
                                <div className={`conversation-avatar ${isUserOnline(conv) ? 'online' : ''}`}>
                                    {getConversationInitials(conv)}
                                </div>
                                <div className="conversation-info">
                                    <div className="conversation-name">
                                        <span>{getConversationName(conv)}</span>
                                        {conv.lastMessage && (
                                            <span className="conversation-time">
                                                {formatTime(conv.lastMessage.createdAt)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="conversation-preview">
                                        {conv.lastMessage?.content || 'No messages yet'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Connection Status */}
                <div
                    style={{
                        padding: 'var(--spacing-sm) var(--spacing-lg)',
                        borderTop: '1px solid var(--gray-100)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        fontSize: '0.75rem',
                        color: isConnected ? 'var(--success-500)' : 'var(--gray-400)',
                    }}
                >
                    <span
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: isConnected ? 'var(--success-500)' : 'var(--gray-300)',
                        }}
                    />
                    {isConnected ? 'Connected' : 'Connecting...'}
                </div>
            </aside>

            {/* Chat Main Area */}
            <main className="chat-main">
                {currentConversation ? (
                    <>
                        <header className="chat-header">
                            <div className={`conversation-avatar ${isUserOnline(currentConversation) ? 'online' : ''}`}>
                                {getConversationInitials(currentConversation)}
                            </div>
                            <div className="chat-header-info">
                                <div className="chat-header-name">
                                    {getConversationName(currentConversation)}
                                </div>
                                <div className={`chat-header-status ${isUserOnline(currentConversation) ? 'online' : ''}`}>
                                    {isUserOnline(currentConversation) ? 'Online' : 'Offline'}
                                </div>
                            </div>
                            <button
                                className="btn btn-icon btn-ghost"
                                onClick={() => clearChat()}
                                title="Close Chat"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        <div className="chat-messages">
                            {messages.map((message, index) => {
                                const isSent = message.senderId === user?.id;
                                const showAvatar =
                                    !isSent &&
                                    (index === 0 || messages[index - 1].senderId !== message.senderId);

                                return (
                                    <div
                                        key={message.id}
                                        className={`message-group ${isSent ? 'sent' : 'received'}`}
                                    >
                                        {!isSent && showAvatar && (
                                            <div className="message-avatar">
                                                {getInitials(message.sender.firstName, message.sender.lastName)}
                                            </div>
                                        )}
                                        {!isSent && !showAvatar && <div style={{ width: '32px' }} />}
                                        <div className="message-content">
                                            <div className={`message-bubble ${message.isDeleted ? 'deleted' : ''}`}>
                                                {message.content}
                                            </div>
                                            <div className="message-time">
                                                {formatTime(message.createdAt)}
                                                {message.isEdited && ' · Edited'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Typing Indicator */}
                            {currentTypingUsers.size > 0 && (
                                <div className="typing-indicator">
                                    <div className="typing-dots">
                                        <span />
                                        <span />
                                        <span />
                                    </div>
                                    <span>Someone is typing...</span>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-area">
                            <div className="chat-input-container">
                                <textarea
                                    className="chat-input"
                                    placeholder="Type a message..."
                                    value={messageInput}
                                    onChange={(e) => handleInputChange(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    rows={1}
                                />
                                <button
                                    className="chat-send-btn"
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim()}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">
                            <MessageSquare size={32} />
                        </div>
                        <h3>Select a conversation</h3>
                        <p>Choose a conversation from the list to start messaging</p>
                    </div>
                )}
            </main>

            {/* New Chat Modal */}
            {showNewChatModal && (
                <NewChatModal onClose={() => setShowNewChatModal(false)} />
            )}
        </div>
    );
}
