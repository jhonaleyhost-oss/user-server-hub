import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import AdminOfflinePanels from '@/components/AdminOfflinePanels';

const AdminOfflinePanelsPage = () => (
  <AdminLayout title="Panel Offline" description="Scan & hapus panel yang mati">
    <GlassCard className="p-4 sm:p-6">
      <AdminOfflinePanels />
    </GlassCard>
  </AdminLayout>
);

export default AdminOfflinePanelsPage;