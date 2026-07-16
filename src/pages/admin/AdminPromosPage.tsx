import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import AdminPromos from '@/components/AdminPromos';

const AdminPromosPage = () => (
  <AdminLayout title="Promo Codes" description="Kelola kode promo pengguna">
    <GlassCard className="p-4 sm:p-6">
      <AdminPromos />
    </GlassCard>
  </AdminLayout>
);

export default AdminPromosPage;