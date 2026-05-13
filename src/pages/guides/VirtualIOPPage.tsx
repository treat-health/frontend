import { useNavigate } from 'react-router-dom';
import VirtualIOPView from '../dashboard/views/VirtualIOPView';

export default function VirtualIOPPage() {
    const navigate = useNavigate();

    return <VirtualIOPView onClose={() => navigate('/dashboard')} />;
}
