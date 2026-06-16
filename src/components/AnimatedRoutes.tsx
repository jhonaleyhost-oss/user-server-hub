import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Dashboard from '@/pages/Dashboard';
import Auth from '@/pages/Auth';
import ResetPassword from '@/pages/ResetPassword';
import Panels from '@/pages/Panels';
import Admin from '@/pages/Admin';
import AdminRoute from '@/components/AdminRoute';
import Upgrade from '@/pages/Upgrade';
import Profile from '@/pages/Profile';
import Users from '@/pages/Users';
import Chat from '@/pages/Chat';
import Feedback from '@/pages/Feedback';
import Activity from '@/pages/Activity';
import NotFound from '@/pages/NotFound';
import Support from '@/pages/Support';
import AdsRental from '@/pages/AdsRental';
import Promos from '@/pages/Promos';
import Notifications from '@/pages/Notifications';

export const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/panels" element={<Panels />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users" element={<Users />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/support" element={<Support />} />
        <Route path="/sewa-iklan" element={<AdsRental />} />
        <Route path="/promo" element={<Promos />} />
        <Route path="/notifikasi" element={<Notifications />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};
