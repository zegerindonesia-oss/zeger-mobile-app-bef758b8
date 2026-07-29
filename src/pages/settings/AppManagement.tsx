import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Image, Award, Users, Ticket, TrendingUp, Settings, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function AppManagement() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBanners: 0,
    activeBanners: 0,
    totalCustomers: 0,
    totalRewards: 0
  });

  useEffect(() => {
    document.title = 'App Management | Zeger ERP';
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [bannersRes, customersRes, rewardsRes] = await Promise.all([
        supabase.from('promo_banners').select('id, is_active', { count: 'exact' }),
        supabase.from('customer_users').select('id', { count: 'exact' }),
        supabase.from('loyalty_rewards').select('id', { count: 'exact' })
      ]);

      const activeBanners = bannersRes.data?.filter(b => b.is_active).length || 0;

      setStats({
        totalBanners: bannersRes.count || 0,
        activeBanners,
        totalCustomers: customersRes.count || 0,
        totalRewards: rewardsRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const managementSections = [
    {
      title: "Promo & Banners",
      description: "Kelola banner promosi di aplikasi customer",
      icon: Image,
      path: "/settings/app-management/promo-banners",
      stats: `${stats.activeBanners} aktif dari ${stats.totalBanners} banner`,
      color: "text-blue-600 bg-blue-50"
    },
    {
      title: "Loyalty Settings",
      description: "Atur tier loyalty & reward points",
      icon: Award,
      path: "/settings/app-management/loyalty",
      stats: `${stats.totalRewards} rewards tersedia`,
      color: "text-purple-600 bg-purple-50"
    },
    {
      title: "CRM",
      description: "Customer Relationship Management",
      icon: Users,
      path: "/settings/app-management/crm",
      stats: `${stats.totalCustomers} customers terdaftar`,
      color: "text-green-600 bg-green-50"
    },
    {
      title: "Vouchers",
      description: "Kelola voucher & kupon diskon",
      icon: Ticket,
      path: "/settings/app-management/vouchers",
      stats: "Kelola kode voucher",
      color: "text-orange-600 bg-orange-50"
    },
    {
      title: "Subscription Plans",
      description: "Kelola paket langganan customer",
      icon: Package,
      path: "/settings/app-management/subscriptions",
      stats: "Kelola paket subscription",
      color: "text-emerald-600 bg-emerald-50"
    },
    {
      title: "Customer App Settings",
      description: "Toggle modul, layout home, Care, Referral",
      icon: Settings,
      path: "/settings/app-management/customer-app",
      stats: "Layout & feature toggle",
      color: "text-red-600 bg-red-50"
    }
  ];

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Smartphone className="w-6 h-6" />
          App Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelola seluruh aspek aplikasi customer dari satu tempat
        </p>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Image className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.activeBanners}</p>
                <p className="text-xs text-muted-foreground">Banner Aktif</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.totalCustomers}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{stats.totalRewards}</p>
                <p className="text-xs text-muted-foreground">Rewards Tersedia</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">24%</p>
                <p className="text-xs text-muted-foreground">Growth Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {managementSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.path} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${section.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{section.stats}</p>
                <Button onClick={() => navigate(section.path)} className="w-full">Kelola</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
