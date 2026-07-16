import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import AdminInactiveUsers from '@/components/AdminInactiveUsers';

const AdminInactivePage = () => (
  <AdminLayout title="Akun Nonaktif" description="Akun idle >1 bulan (exclude reseller & adp)">
    <GlassCard className="p-4 sm:p-6">
      <AdminInactiveUsers />
    </GlassCard>
  </AdminLayout>
);

export default AdminInactivePage;