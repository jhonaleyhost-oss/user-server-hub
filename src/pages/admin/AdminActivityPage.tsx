import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import AdminActivityLogs from '@/components/AdminActivityLogs';

const AdminActivityPage = () => (
  <AdminLayout title="Log Aktivitas" description="Audit trail aktivitas sistem">
    <GlassCard className="p-4 sm:p-6">
      <AdminActivityLogs />
    </GlassCard>
  </AdminLayout>
);

export default AdminActivityPage;