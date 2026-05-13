import { useNavigate } from 'react-router-dom';
import OnboardingGuideView from '../dashboard/views/OnboardingGuideView';

export default function OnboardingGuidePage() {
    const navigate = useNavigate();

    return <OnboardingGuideView onClose={() => navigate('/dashboard')} />;
}
