import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Package, 
  FileText, 
  Settings,
  BarChart3,
  ShoppingCart
} from "lucide-react";
import { UserManagement } from "@/components/user/UserManagement";
import { StockTransfer } from "@/components/stock/StockTransfer";
import { SalesReporting } from "@/components/sales/SalesReporting";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  role: 'ho_admin' | 'branch_manager' | 'rider' | 'finance' | 'customer';
  branch_id?: string;
  full_name: string;
}

const AdminDashboard = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(profileData);
    } catch (error: any) {
      toast.error("Gagal memuat profil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">Profil tidak ditemukan. Silakan login ulang.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dashboard p-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Dashboard {profile.role === 'ho_admin' ? 'Admin HO' : 'Manajer Cabang'}</h1>
          <p className="text-muted-foreground">
            Selamat datang, {profile.full_name}
          </p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Manajemen User
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Transfer Stok
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Laporan Penjualan
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analitik
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            {(profile.role === 'ho_admin' || profile.role === 'branch_manager') && (
              <UserManagement role={profile.role} branchId={profile.branch_id} />
            )}
          </TabsContent>

          <TabsContent value="stock">
            {(profile.role === 'ho_admin' || profile.role === 'branch_manager') && (
              <StockTransfer role={profile.role} userId={profile.id} branchId={profile.branch_id} />
            )}
          </TabsContent>

          <TabsContent value="reports">
            {profile.role === 'branch_manager' && (
              <SalesReporting role="branch_manager" userId={profile.id} branchId={profile.branch_id} />
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="dashboard-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Analitik Penjualan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Dashboard analitik akan ditampilkan di sini.</p>
                </CardContent>
              </Card>

              <Card className="dashboard-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Performa User
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Metrik performa user akan ditampilkan di sini.</p>
                </CardContent>
              </Card>

              <Card className="dashboard-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Status Inventori
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Inventori real-time akan ditampilkan di sini.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;