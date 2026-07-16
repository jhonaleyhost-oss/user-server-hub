import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import AdminBroadcast from '@/components/AdminBroadcast';

const AdminBroadcastPage = () => (
  <AdminLayout title="Broadcast" description="Kirim pesan ke seluruh pengguna">
    <GlassCard className="p-4 sm:p-6">
      <AdminBroadcast />
    </GlassCard>
  </AdminLayout>
);

export default AdminBroadcastPage;