import { Package, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface InventoryStatusProps {
  role: 'ho' | 'branch' | 'rider';
}

const inventoryData = {
  ho: [
    { name: "Nasi Gudeg", stock: 450, max: 500, status: "good", category: "Main Dish" },
    { name: "Gado-gado", stock: 120, max: 300, status: "low", category: "Salad" },
    { name: "Nasi Padang", stock: 280, max: 400, status: "good", category: "Main Dish" },
    { name: "Es Teh Manis", stock: 50, max: 200, status: "critical", category: "Beverage" },
    { name: "Soto Ayam", stock: 180, max: 250, status: "good", category: "Soup" }
  ],
  branch: [
    { name: "Nasi Gudeg", stock: 25, max: 50, status: "good", category: "Main Dish" },
    { name: "Gado-gado", stock: 8, max: 30, status: "low", category: "Salad" },
    { name: "Nasi Padang", stock: 15, max: 40, status: "good", category: "Main Dish" },
    { name: "Es Teh Manis", stock: 5, max: 20, status: "critical", category: "Beverage" }
  ],
  rider: [
    { name: "Nasi Gudeg", stock: 8, max: 15, status: "good", category: "Main Dish" },
    { name: "Gado-gado", stock: 2, max: 10, status: "low", category: "Salad" },
    { name: "Nasi Padang", stock: 3, max: 12, status: "low", category: "Main Dish" },
    { name: "Es Teh Manis", stock: 1, max: 8, status: "critical", category: "Beverage" }
  ]
};

export const InventoryStatus = ({ role }: InventoryStatusProps) => {
  const inventory = inventoryData[role];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'good':
        return {
          color: 'bg-success',
          textColor: 'text-success',
          bgColor: 'bg-success/10',
          icon: CheckCircle,
          label: 'Good'
        };
      case 'low':
        return {
          color: 'bg-warning',
          textColor: 'text-warning',
          bgColor: 'bg-warning/10',
          icon: Clock,
          label: 'Low'
        };
      case 'critical':
        return {
          color: 'bg-destructive',
          textColor: 'text-destructive',
          bgColor: 'bg-destructive/10',
          icon: AlertTriangle,
          label: 'Critical'
        };
      default:
        return {
          color: 'bg-muted',
          textColor: 'text-muted-foreground',
          bgColor: 'bg-muted/10',
          icon: Package,
          label: 'Unknown'
        };
    }
  };

  return (
    <div className="dashboard-card animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Status Inventori</h3>
        <Badge variant="outline" className="text-xs">
          {role === 'ho' ? 'Semua Cabang' : role === 'branch' ? 'Stok Cabang' : 'Stok Mobile'}
        </Badge>
      </div>
      
      <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
        {inventory.map((item, index) => {
          const percentage = (item.stock / item.max) * 100;
          const statusConfig = getStatusConfig(item.status);
          const StatusIcon = statusConfig.icon;
          
          return (
            <div
              key={item.name}
              className="p-3 glass rounded-xl hover:bg-white/5 transition-colors duration-200"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${statusConfig.bgColor}`}>
                    <Package className="w-3 h-3" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${statusConfig.textColor} ${statusConfig.bgColor} border-0`}
                  >
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Level Stok</span>
                  <span className="font-medium text-foreground">
                    {item.stock}/{item.max} item
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-2"
                  style={{
                    background: 'hsl(var(--muted))'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};