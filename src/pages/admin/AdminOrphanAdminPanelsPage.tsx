import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import AdminOrphanAdminPanels from '@/components/AdminOrphanAdminPanels';

const AdminOrphanAdminPanelsPage = () => (
  <AdminLayout title="Orphan Admin Panel" description="Scan & hapus Admin Panel yang user Pterodactyl-nya sudah tidak ada">
    <GlassCard className="p-4 sm:p-6">
      <AdminOrphanAdminPanels />
    </GlassCard>
  </AdminLayout>
);

export default AdminOrphanAdminPanelsPage;