import { useNavigate } from 'react-router-dom';
import JoinGuideView from '../dashboard/views/JoinGuideView';

export default function JoinAppointmentGuidePage() {
    const navigate = useNavigate();

    return <JoinGuideView onClose={() => navigate('/dashboard')} />;
}
