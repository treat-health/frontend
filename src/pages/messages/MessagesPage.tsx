import { useEffect, useState, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { MessageSquare, Send, Search, Plus, X, Paperclip, FileText, Phone } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useCallStore } from '../../stores/callStore';
import type { AdminUser } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import '../../styles/chat.css';
import NewChatModal from './NewChatModal';
import CallOverlay from './CallOverlay';

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
        fetchConversations,
        selectConversation,
        startTyping,
        stopTyping,
        clearChat,
        fetchAdminUsers,
        createDirectConversation,
    } = useChatStore();
    const { startCall } = useCallStore();

    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Admin Directory State
    const isAdminType = user?.role === 'ADMIN' || user?.role === 'PROGRAM_DIRECTOR';
    const [activeTab, setActiveTab] = useState<'chats' | 'clients' | 'therapists'>('chats');
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [adminUsersPage, setAdminUsersPage] = useState(1);
    const [adminUsersHasMore, setAdminUsersHasMore] = useState(false);
    const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState(false);

    // Initialize fetch conversations
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initialize Twilio Voice Device when a direct conversation is selected
    useEffect(() => {
        if (currentConversation && currentConversation.type === 'DIRECT') {
            useCallStore.getState().initDevice(currentConversation.id);
        }
    }, [currentConversation?.id, currentConversation?.type]);

    // Fetch Admin Users
    useEffect(() => {
        if (activeTab === 'chats' || !isAdminType) return;
        let isMounted = true;

        const fetchUsers = async () => {
            setIsLoadingAdminUsers(true);
            const role = activeTab === 'clients' ? 'CLIENT' : 'THERAPIST';
            const result = await fetchAdminUsers(role, 1, searchQuery);

            if (!isMounted) return;

            if (result) {
                setAdminUsers(result.users);
                setAdminUsersHasMore(result.pagination.page < result.pagination.totalPages);
                setAdminUsersPage(1);
            } else {
                setAdminUsers([]);
                setAdminUsersHasMore(false);
            }
            setIsLoadingAdminUsers(false);
        };

        const timer = setTimeout(fetchUsers, 300); // debounce search
        return () => {
            clearTimeout(timer);
            isMounted = false;
        };
    }, [activeTab, searchQuery, fetchAdminUsers, isAdminType]);

    const loadMoreAdminUsers = async () => {
        if (isLoadingAdminUsers || !adminUsersHasMore) return;
        setIsLoadingAdminUsers(true);
        const role = activeTab === 'clients' ? 'CLIENT' : 'THERAPIST';
        const nextPage = adminUsersPage + 1;
        const result = await fetchAdminUsers(role, nextPage, searchQuery);

        if (result) {
            setAdminUsers(prev => [...prev, ...result.users]);
            setAdminUsersHasMore(result.pagination.page < result.pagination.totalPages);
            setAdminUsersPage(nextPage);
        }
        setIsLoadingAdminUsers(false);
    };

    const handleAdminUserClick = async (userId: string) => {
        try {
            const conv = await createDirectConversation(userId);
            setActiveTab('chats');
            await selectConversation(conv.id);
        } catch (error) {
            console.error('Failed to start override chat', error);
        }
    };

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

    // Clear selected file and revoke blob URL
    const clearSelectedFile = useCallback(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(null);
        setPreviewUrl(null);
    }, [previewUrl]);

    // Send message (Handles Text + Attachment)
    const handleSendMessage = useCallback(() => {
        if (!messageInput.trim() && !selectedFile) return;

        if (selectedFile && currentConversation) {
            useChatStore.getState().sendAttachmentOptimistically(selectedFile, previewUrl, messageInput.trim(), currentConversation.id);
        } else if (messageInput.trim() && currentConversation) {
            useChatStore.getState().sendMessage(messageInput.trim());
        }

        setMessageInput('');
        clearSelectedFile();
        stopTyping();
    }, [messageInput, selectedFile, currentConversation, previewUrl, stopTyping, clearSelectedFile]);

    // Format bytes to human-readable
    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

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

    // Get unread count for current user in a conversation
    const getUnreadCount = (conv: typeof conversations[0]): number => {
        const myParticipant = conv.participants.find(
            p => p.userId === user?.id || p.user?.id === user?.id
        );
        return myParticipant?.unreadCount || 0;
    };

    // Get typing users for current conversation
    const currentTypingUsers = currentConversation
        ? typingUsers.get(currentConversation.id) || new Set()
        : new Set();

    // Filter and sort conversations (most recent on top)
    const filteredConversations = conversations
        .filter((conv) =>
            getConversationName(conv).toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            const aTime = a.lastMessage?.createdAt || a.updatedAt;
            const bTime = b.lastMessage?.createdAt || b.updatedAt;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

    return (
        <div className="chat-layout">
            <aside className="chat-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Header row: title + new chat button */}
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

                {/* Admin-only tab bar — lives between header and search */}
                {isAdminType && (
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        padding: '0 16px',
                        borderBottom: '1px solid var(--gray-200)',
                        flexShrink: 0,
                    }}>
                        {(['chats', 'clients', 'therapists'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '10px 8px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: activeTab === tab ? '600' : '400',
                                    color: activeTab === tab ? 'var(--primary-600)' : 'var(--gray-500)',
                                    borderBottom: activeTab === tab
                                        ? '2px solid var(--primary-600)'
                                        : '2px solid transparent',
                                    textTransform: 'capitalize',
                                    whiteSpace: 'nowrap',
                                    transition: 'color 0.15s, border-color 0.15s',
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                )}

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
                            placeholder={activeTab === 'chats' ? "Search conversations..." : `Search ${activeTab}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '36px' }}
                            aria-label="Search conversations"
                        />
                    </div>
                </div>

                <div className="conversation-list">
                    {isLoading && (
                        <div className="flex justify-center items-center" style={{ padding: '2rem' }}>
                            <div className="spinner spinner-dark" />
                        </div>
                    )}

                    {activeTab === 'chats' && !isLoading && filteredConversations.length === 0 && (
                        <div className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                            No conversations yet
                        </div>
                    )}

                    {activeTab === 'chats' && !isLoading && filteredConversations.length > 0 && filteredConversations.map((conv) => {
                        const unread = getUnreadCount(conv);
                        return (
                            <button
                                key={conv.id}
                                type="button"
                                className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''} ${unread > 0 ? 'unread' : ''}`}
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
                                {unread > 0 && (
                                    <div className="conversation-unread">
                                        {unread > 99 ? '99+' : unread}
                                    </div>
                                )}
                            </button>
                        );
                    })}

                    {/* Admin Directory List */}
                    {activeTab !== 'chats' && !isLoadingAdminUsers && adminUsers.length === 0 && (
                        <div className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                            No users found
                        </div>
                    )}

                    {activeTab !== 'chats' && adminUsers.length > 0 && (
                        <>
                            {adminUsers.map((u) => (
                                <button
                                    key={u.id}
                                    type="button"
                                    className="conversation-item"
                                    onClick={() => handleAdminUserClick(u.id)}
                                >
                                    <div className="conversation-avatar">
                                        {getInitials(u.firstName, u.lastName)}
                                    </div>
                                    <div className="conversation-info">
                                        <div className="conversation-name">
                                            <span>{u.firstName} {u.lastName}</span>
                                        </div>
                                        <div className="conversation-preview" style={{ color: 'var(--gray-500)' }}>
                                            {u.role.replace('_', ' ')}
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {adminUsersHasMore && (
                                <div style={{ padding: '16px', textAlign: 'center' }}>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={loadMoreAdminUsers}
                                        disabled={isLoadingAdminUsers}
                                    >
                                        {isLoadingAdminUsers ? 'Loading...' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </>
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
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {currentConversation.type === 'DIRECT' && (
                                    <button
                                        className="btn btn-icon btn-ghost"
                                        onClick={() => {
                                            const otherParticipant = currentConversation.participants.find(p => p.user.id !== user?.id);
                                            if (otherParticipant) {
                                                startCall(currentConversation.id, otherParticipant.user.id);
                                            }
                                        }}
                                        title="Start Audio Call"
                                    >
                                        <Phone size={20} />
                                    </button>
                                )}
                                <button
                                    className="btn btn-icon btn-ghost"
                                    onClick={() => clearChat()}
                                    title="Close Chat"
                                >
                                    <X size={20} />
                                </button>
                            </div>
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
                                                {/* Attachment Rendering */}
                                                {(message.contentType === 'IMAGE' || message.contentType === 'FILE') && (
                                                    <div style={{ position: 'relative' }}>
                                                        {message.status === 'uploading' && (
                                                            <div style={{
                                                                position: 'absolute', inset: 0,
                                                                backgroundColor: 'rgba(0,0,0,0.5)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                borderRadius: '8px', zIndex: 10
                                                            }}>
                                                                <div className="spinner spinner-light" style={{ width: '20px', height: '20px' }} />
                                                            </div>
                                                        )}
                                                        {message.status === 'failed' && (
                                                            <div style={{
                                                                position: 'absolute', inset: 0,
                                                                backgroundColor: 'rgba(0,0,0,0.7)',
                                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                                borderRadius: '8px', zIndex: 10, gap: '8px'
                                                            }}>
                                                                <span style={{ color: 'white', fontSize: '12px' }}>Upload failed</span>
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button onClick={() => useChatStore.getState().retryAttachmentUpload(message.tempId!)} className="btn btn-sm btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }}>Retry</button>
                                                                    <button onClick={() => useChatStore.getState().cancelAttachmentUpload(message.tempId!)} className="btn btn-sm btn-danger" style={{ padding: '4px 8px', fontSize: '12px' }}>Cancel</button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {message.contentType === 'IMAGE' ? (
                                                            <a href={message.attachmentUrl || message.previewUrl || '#'} target={message.attachmentUrl ? '_blank' : undefined} rel="noopener noreferrer">
                                                                <img
                                                                    src={message.attachmentUrl || message.previewUrl}
                                                                    alt={message.attachmentName || 'Image'}
                                                                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', cursor: 'pointer', display: 'block', opacity: message.status === 'uploading' ? 0.7 : 1 }}
                                                                />
                                                            </a>
                                                        ) : (
                                                            <a
                                                                href={message.attachmentUrl || '#'}
                                                                target={message.attachmentUrl ? '_blank' : undefined}
                                                                rel="noopener noreferrer"
                                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit', textDecoration: 'none', opacity: message.status === 'uploading' ? 0.7 : 1 }}
                                                            >
                                                                <FileText size={20} />
                                                                <span style={{ fontWeight: 500, textDecoration: 'underline' }}>{message.attachmentName || 'Document'}</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Text Content */}
                                                {message.content && message.content !== 'Attachment' && (
                                                    <div style={{ marginTop: (message.contentType !== 'TEXT' && (message.attachmentUrl || message.previewUrl)) ? '8px' : '0' }}>
                                                        {message.content}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="message-time">
                                                {formatTime(message.createdAt)}
                                                {message.isEdited && ' · Edited'}
                                                {message.status === 'uploading' && ' · Sending...'}
                                                {message.status === 'failed' && <span style={{ color: 'var(--danger-500)', marginLeft: '4px' }}>· Failed</span>}
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
                            {/* WhatsApp-style attachment preview */}
                            {selectedFile && (
                                <div style={{
                                    position: 'relative',
                                    marginBottom: '8px',
                                    padding: '8px',
                                    backgroundColor: 'var(--gray-800, #1e1e2e)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--gray-700, #333)',
                                    display: 'inline-block',
                                    maxWidth: '240px',
                                }}>
                                    {selectedFile.type.startsWith('image/') && previewUrl ? (
                                        // Image thumbnail preview
                                        <img
                                            src={previewUrl}
                                            alt={selectedFile.name}
                                            style={{
                                                display: 'block',
                                                maxWidth: '220px',
                                                maxHeight: '160px',
                                                objectFit: 'cover',
                                                borderRadius: '8px',
                                            }}
                                        />
                                    ) : (
                                        // Document pill
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px' }}>
                                            <FileText size={28} style={{ color: 'var(--primary-400, #a78bfa)', flexShrink: 0 }} />
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-100)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                                                    {selectedFile.name}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                                                    {formatBytes(selectedFile.size)}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Caption below image */}
                                    {selectedFile.type.startsWith('image/') && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: '4px', paddingLeft: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {selectedFile.name} · {formatBytes(selectedFile.size)}
                                        </div>
                                    )}
                                    {/* X dismiss button */}
                                    <button
                                        onClick={clearSelectedFile}
                                        style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            background: 'var(--gray-600)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '22px',
                                            height: '22px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: 'white',
                                        }}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}

                            <div className="chat-input-container">
                                <button
                                    className="btn btn-icon btn-ghost"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Attach File"
                                    style={{ color: 'var(--gray-500)', padding: '8px' }}
                                >
                                    <Paperclip size={20} />
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*,application/pdf,.doc,.docx,.txt,audio/*,video/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setSelectedFile(file);
                                            if (file.type.startsWith('image/')) {
                                                if (previewUrl) URL.revokeObjectURL(previewUrl);
                                                setPreviewUrl(URL.createObjectURL(file));
                                            } else {
                                                setPreviewUrl(null);
                                            }
                                        }
                                        e.target.value = '';
                                    }}
                                />
                                <textarea
                                    className="chat-input"
                                    placeholder="Type a message..."
                                    value={messageInput}
                                    onChange={(e) => handleInputChange(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    rows={1}
                                    aria-label="Message input"
                                />
                                <button
                                    className="chat-send-btn"
                                    onClick={handleSendMessage}
                                    disabled={(!messageInput.trim() && !selectedFile) || useChatStore.getState().isSending}
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

            {/* Voice Call UI Modal */}
            <CallOverlay />
        </div>
    );
}
