import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import AdminAdRentals from '@/components/AdminAdRentals';

const AdminAdsPage = () => (
  <AdminLayout title="Sewa Iklan" description="Manajemen iklan yang disewa user">
    <GlassCard className="p-4 sm:p-6">
      <AdminAdRentals />
    </GlassCard>
  </AdminLayout>
);

export default AdminAdsPage;