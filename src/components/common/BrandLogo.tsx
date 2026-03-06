import logoIcon from '../../assets/logo-icon.png';
import logoText from '../../assets/logo-text.png';

interface BrandLogoProps {
    variant?: 'light' | 'dark'; // For text color if we were using text, but images might need filters
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export default function BrandLogo({ variant = 'dark', size = 'md', className = '' }: BrandLogoProps) {
    // Sizes for the Icon - CHANGE THESE VALUES to increase/decrease icon size
    const iconSizes = {
        sm: { height: 40 },
        md: { height: 50 },
        lg: { height: 75 },
        xl: { height: 125 },
    };

    // Sizes for the Text - CHANGE THESE VALUES to increase/decrease text size
    const textSizes = {
        sm: { height: 57 },
        md: { height: 65 },
        lg: { height: 83 },
        xl: { height: 121 },
    };
    // Apply brightness filter for 'light' variant (on dark backgrounds)
    const filterStyle = variant === 'light' ? { filter: 'brightness(0) invert(1)' } : {};

    return (
        <div className={`flex items-center gap-md ${className}`}>
            <img
                src={logoIcon}
                alt="Treat Health Icon"
                style={{
                    ...iconSizes[size],
                    objectFit: 'contain'
                }}
            />
            <img
                src={logoText}
                alt="Treat Health"
                style={{
                    ...textSizes[size],
                    objectFit: 'contain',
                    marginTop: '-10px', // Shift up slightly to align with the gem icon
                    ...filterStyle
                }}
            />
        </div>
    );
}
