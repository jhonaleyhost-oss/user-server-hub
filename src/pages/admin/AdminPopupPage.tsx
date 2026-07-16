import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import AdminPopupManager from '@/components/AdminPopupManager';

const AdminPopupPage = () => (
  <AdminLayout title="Popup" description="Kelola popup announcement">
    <GlassCard className="p-4 sm:p-6">
      <AdminPopupManager />
    </GlassCard>
  </AdminLayout>
);

export default AdminPopupPage;