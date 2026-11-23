import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import BookingList from '../components/BookingList.jsx';
import { PageHead } from '../components/ui.jsx';

export default function CustomerDashboard() {
  const { user } = useAuth();
  return (
    <>
      <PageHead title={`Salaam, ${user.full_name.split(' ')[0]}`}><Link to="/search" className="btn-primary btn-sm">Find a service</Link></PageHead>
      <h2 className="mb-3 text-xl font-bold">My bookings</h2>
      <BookingList role="customer" />
    </>
  );
}
