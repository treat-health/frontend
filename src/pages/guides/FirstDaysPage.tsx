import { useNavigate } from 'react-router-dom';
import FirstDaysView from '../dashboard/views/FirstDaysView';

export default function FirstDaysPage() {
    const navigate = useNavigate();

    return <FirstDaysView onClose={() => navigate('/dashboard')} />;
}
