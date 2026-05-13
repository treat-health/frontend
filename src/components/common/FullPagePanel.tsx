import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './FullPagePanel.css';

interface FullPagePanelProps {
    icon: LucideIcon;
    iconColor?: string;
    iconBg?: string;
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
}

export default function FullPagePanel({
    icon: Icon,
    iconColor,
    iconBg,
    title,
    subtitle,
    onClose,
    children,
}: Readonly<FullPagePanelProps>) {
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, []);

    return (
        <div className="fpp-root">
            <div className="fpp-header">
                <div className="fpp-header-left">
                    <div
                        className="fpp-icon-wrap"
                        style={{
                            color: iconColor ?? 'var(--primary-600)',
                            background: iconBg ?? 'var(--primary-100)',
                        }}
                    >
                        <Icon size={20} />
                    </div>
                    <div className="fpp-title-group">
                        <h2 className="fpp-title">{title}</h2>
                        {subtitle && <p className="fpp-subtitle">{subtitle}</p>}
                    </div>
                </div>
                <button
                    type="button"
                    className="fpp-close"
                    onClick={onClose}
                    aria-label="Back to Dashboard"
                    title="Back to Dashboard"
                >
                    <X size={18} />
                </button>
            </div>
            <div className="fpp-body">
                {children}
            </div>
        </div>
    );
}
