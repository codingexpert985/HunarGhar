import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Protected from './components/Guards.jsx';
import { Empty } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import ProviderProfile from './pages/ProviderProfile.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Assistant from './pages/Assistant.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import Payment from './pages/Payment.jsx';
import CustomerDashboard from './pages/CustomerDashboard.jsx';
import ProviderDashboard from './pages/ProviderDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="providers/:id" element={<ProviderProfile />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="customer/dashboard" element={<Protected roles={['customer']}><CustomerDashboard /></Protected>} />
        <Route path="provider/dashboard" element={<Protected roles={['provider']}><ProviderDashboard /></Protected>} />
        <Route path="admin/dashboard" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
        <Route path="bookings/:id" element={<Protected><BookingDetail /></Protected>} />
        <Route path="bookings/:id/payment" element={<Protected roles={['customer']}><Payment /></Protected>} />
        <Route path="*" element={<Empty title="Page not found" action={<Link to="/" className="btn-primary btn-sm">Go home</Link>}>The page you are looking for does not exist.</Empty>} />
      </Route>
    </Routes>
  );
}
