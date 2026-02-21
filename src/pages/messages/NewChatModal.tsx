import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import toast from 'react-hot-toast';

interface NewChatModalProps {
    onClose: () => void;
}

interface AssignableUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
}

export default function NewChatModal({ onClose }: NewChatModalProps) {
    const { user } = useAuthStore();
    const { createDirectConversation, selectConversation } = useChatStore();
    const [users, setUsers] = useState<AssignableUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');


    useEffect(() => {
        fetchAssignableUsers();
    }, []);

    const fetchAssignableUsers = async () => {
        setIsLoading(true);
        try {
            // Determine which endpoint to call based on role
            const endpoint = user?.role === 'CLIENT'
                ? '/assignments/my-therapist'
                : '/assignments/my-clients';

            const response = await api.get(endpoint);

            if (response.data.success) {
                const data = response.data.data;
                // Normalize data: my-therapist returns single object (or null), my-clients returns array
                if (Array.isArray(data)) {
                    setUsers(data);
                } else if (data) {
                    setUsers([data]);
                } else {
                    setUsers([]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch users', error);
            toast.error('Failed to load contacts');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartChat = async (userId: string) => {
        try {
            const conversation = await createDirectConversation(userId);
            await selectConversation(conversation.id);
            onClose();
        } catch (error) {
            console.error('Failed to start chat', error);
            toast.error('Failed to start conversation');
        }
    };

    const filteredUsers = users.filter((u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px', width: '100%' }}>
                <div className="modal-header">
                    <h3>New Message</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="search-bar" style={{ marginBottom: '1rem' }}>
                        <Search size={18} style={{ color: 'var(--gray-400)' }} />
                        <input
                            type="text"
                            placeholder="Search people..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                border: '1px solid var(--gray-200)',
                                borderRadius: 'var(--radius-md)',
                                outline: 'none',
                            }}
                        />
                    </div>

                    <div className="user-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {isLoading ? (
                            <div className="text-center p-4">Loading contacts...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center p-4 text-gray-500">
                                {searchQuery ? 'No matching contacts' : 'No assigned contacts found'}
                            </div>
                        ) : (
                            filteredUsers.map((u) => (
                                <div
                                    key={u.id}
                                    className="user-item"
                                    onClick={() => handleStartChat(u.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    <div
                                        className="avatar"
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: 'var(--primary-100)',
                                            color: 'var(--primary-600)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: '1rem',
                                            fontWeight: '600',
                                        }}
                                    >
                                        {u.firstName.charAt(0)}
                                        {u.lastName.charAt(0)}
                                    </div>
                                    <div className="user-info">
                                        <div style={{ fontWeight: '500' }}>
                                            {u.firstName} {u.lastName}
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                                            {u.role.replace('_', ' ')}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
