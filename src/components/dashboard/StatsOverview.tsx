import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from "lucide-react";

interface StatsOverviewProps {
  role: 'ho' | 'branch' | 'rider';
}

const statsData = {
  ho: [
    {
      title: "Total Pendapatan",
      value: "Rp 2.480.000.000",
      change: "+12,5%",
      trend: "up",
      icon: DollarSign,
      description: "Semua cabang gabungan"
    },
    {
      title: "Cabang Aktif",
      value: "15",
      change: "+2",
      trend: "up",
      icon: Users,
      description: "Cabang beroperasi"
    },
    {
      title: "Total Rider",
      value: "45",
      change: "+5",
      trend: "up",
      icon: Users,
      description: "Mobile seller aktif"
    },
    {
      title: "Produk Terjual",
      value: "12.450",
      change: "+18,2%",
      trend: "up",
      icon: ShoppingCart,
      description: "Bulan ini"
    }
  ],
  branch: [
    {
      title: "Pendapatan Cabang",
      value: "Rp 165.000.000",
      change: "+8,3%",
      trend: "up",
      icon: DollarSign,
      description: "Bulan ini"
    },
    {
      title: "Rider Aktif",
      value: "3",
      change: "0",
      trend: "stable",
      icon: Users,
      description: "Ditugaskan ke cabang"
    },
    {
      title: "Pesanan Hari Ini",
      value: "87",
      change: "+12",
      trend: "up",
      icon: ShoppingCart,
      description: "Semua rider gabungan"
    },
    {
      title: "Level Stok",
      value: "85%",
      change: "-5%",
      trend: "down",
      icon: Package,
      description: "Status inventori"
    }
  ],
  rider: [
    {
      title: "Penjualan Harian",
      value: "Rp 1.250.000",
      change: "+15,2%",
      trend: "up",
      icon: DollarSign,
      description: "Pendapatan hari ini"
    },
    {
      title: "Pesanan Selesai",
      value: "28",
      change: "+3",
      trend: "up",
      icon: ShoppingCart,
      description: "Hari ini"
    },
    {
      title: "Komisi",
      value: "Rp 125.000",
      change: "+15,2%",
      trend: "up",
      icon: TrendingUp,
      description: "Komisi hari ini"
    },
    {
      title: "Sisa Stok",
      value: "72%",
      change: "-28%",
      trend: "down",
      icon: Package,
      description: "Perlu restok segera"
    }
  ]
};

export const StatsOverview = ({ role }: StatsOverviewProps) => {
  const stats = statsData[role];
  // Route mapping per kartu
  const getRouteForStat = (title: string) => {
    const map: Record<string, string> = {
      'Total Pendapatan': '/reports/transactions',
      'Cabang Aktif': '/branches',
      'Total Rider': '/riders',
      'Produk Terjual': '/reports/transactions',
      'Pendapatan Cabang': '/reports/transactions',
      'Rider Aktif': '/riders',
      'Pesanan Hari Ini': '/reports/transactions',
      'Level Stok': '/pos',
      'Penjualan Harian': '/reports/transactions',
      'Pesanan Selesai': '/reports/transactions',
      'Komisi': '/reports/transactions',
      'Sisa Stok': '/mobile-seller'
    };
    return map[title] || '/';
  };
  
  // Use navigate lazily to avoid import churn on SSR
  const handleClick = (path: string) => {
    import('react-router-dom').then(({ useNavigate }) => {}).catch(()=>{});
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const isPositive = stat.trend === "up";
        const isNegative = stat.trend === "down";
        const path = getRouteForStat(stat.title);
        
        return (
          <a
            key={stat.title}
            href={path}
            className="dashboard-card group hover:scale-105 transition-all duration-300 cursor-pointer block"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-2xl ${
                isPositive ? 'bg-success/10 text-success' :
                isNegative ? 'bg-destructive/10 text-destructive' :
                'bg-primary/10 text-primary'
              }`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                isPositive ? 'bg-success/10 text-success' :
                isNegative ? 'bg-destructive/10 text-destructive' :
                'bg-muted text-muted-foreground'
              }`}>
                {isPositive && <TrendingUp className="w-3 h-3" />}
                {isNegative && <TrendingDown className="w-3 h-3" />}
                {stat.change}
              </div>
            </div>
            
            <div>
              <p className="text-2xl font-bold text-foreground mb-1">
                {stat.value}
              </p>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {stat.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
};