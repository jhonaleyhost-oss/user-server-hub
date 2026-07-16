import AdminLayout from "@/components/AdminLayout";
import GlassCard from "@/components/GlassCard";
import AdminWarrantyClaims from "@/components/AdminWarrantyClaims";

const AdminWarrantyPage = () => (
  <AdminLayout title="Garansi Role" description="Review klaim garansi role & aktifkan otomatis">
    <GlassCard className="p-4 sm:p-6">
      <AdminWarrantyClaims />
    </GlassCard>
  </AdminLayout>
);

export default AdminWarrantyPage;