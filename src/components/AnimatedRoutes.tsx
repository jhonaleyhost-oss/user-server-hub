import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Dashboard from '@/pages/Dashboard';
import Auth from '@/pages/Auth';
import ResetPassword from '@/pages/ResetPassword';
import Panels from '@/pages/Panels';
import Admin from '@/pages/Admin';
import AdminOverview from '@/pages/admin/Overview';
import AdminBroadcastPage from '@/pages/admin/AdminBroadcastPage';
import AdminPromosPage from '@/pages/admin/AdminPromosPage';
import AdminAdsPage from '@/pages/admin/AdminAdsPage';
import AdminPopupPage from '@/pages/admin/AdminPopupPage';
import AdminActivityPage from '@/pages/admin/AdminActivityPage';
import AdminInactivePage from '@/pages/admin/AdminInactivePage';
import AdminOfflinePanelsPage from '@/pages/admin/AdminOfflinePanelsPage';
import AdminOrphanAdminPanelsPage from '@/pages/admin/AdminOrphanAdminPanelsPage';
import AdminRoute from '@/components/AdminRoute';
import Upgrade from '@/pages/Upgrade';
import { Navigate } from 'react-router-dom';
import Profile from '@/pages/Profile';
import Users from '@/pages/Users';
import Chat from '@/pages/Chat';
import Feedback from '@/pages/Feedback';
import Activity from '@/pages/Activity';
import NotFound from '@/pages/NotFound';
import Landing from '@/pages/Landing';
import Support from '@/pages/Support';
import AdsRental from '@/pages/AdsRental';
import Promos from '@/pages/Promos';
import Notifications from '@/pages/Notifications';
import Unsubscribe from '@/pages/Unsubscribe';
import Warranty from '@/pages/Warranty';
import AdminWarrantyPage from '@/pages/admin/AdminWarrantyPage';

export const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/panels" element={<Panels />} />
        <Route path="/admin" element={<AdminRoute><AdminOverview /></AdminRoute>} />
        <Route path="/admin/manage" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/admin/broadcast" element={<AdminRoute><AdminBroadcastPage /></AdminRoute>} />
        <Route path="/admin/promos" element={<AdminRoute><AdminPromosPage /></AdminRoute>} />
        <Route path="/admin/ads" element={<AdminRoute><AdminAdsPage /></AdminRoute>} />
        <Route path="/admin/popup" element={<AdminRoute><AdminPopupPage /></AdminRoute>} />
        <Route path="/admin/activity" element={<AdminRoute><AdminActivityPage /></AdminRoute>} />
        <Route path="/admin/inactive" element={<AdminRoute><AdminInactivePage /></AdminRoute>} />
        <Route path="/admin/offline-panels" element={<AdminRoute><AdminOfflinePanelsPage /></AdminRoute>} />
        <Route path="/admin/orphan-admin-panels" element={<AdminRoute><AdminOrphanAdminPanelsPage /></AdminRoute>} />
        <Route path="/admin/warranty" element={<AdminRoute><AdminWarrantyPage /></AdminRoute>} />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/upgrade-adp" element={<Navigate to="/upgrade?tier=adp" replace />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users" element={<Users />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/support" element={<Support />} />
        <Route path="/sewa-iklan" element={<AdsRental />} />
        <Route path="/promo" element={<Promos />} />
        <Route path="/notifikasi" element={<Notifications />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/garansi" element={<Warranty />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};
