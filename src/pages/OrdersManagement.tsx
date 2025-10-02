import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  ShoppingBag, Search, Eye, Truck, MapPin, 
  Clock, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Package
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_price: number;
  payment_method: string;
  delivery_address: string;
  order_type: string;
  user_id: string;
  rider_id: string | null;
  customer_users: {
    name: string;
    phone: string;
  };
  rider?: {
    name: string;
    phone: string;
  };
  order_items: Array<{
    quantity: number;
    product: {
      name: string;
    };
  }>;
}

const statusConfig = {
  pending: { label: 'Menunggu', color: 'bg-yellow-500', icon: Clock },
  confirmed: { label: 'Dikonfirmasi', color: 'bg-blue-500', icon: CheckCircle },
  preparing: { label: 'Diproses', color: 'bg-purple-500', icon: Package },
  on_delivery: { label: 'Dalam Pengiriman', color: 'bg-indigo-500', icon: Truck },
  delivered: { label: 'Terkirim', color: 'bg-green-500', icon: CheckCircle },
  completed: { label: 'Selesai', color: 'bg-green-600', icon: CheckCircle },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-500', icon: XCircle },
  rejected: { label: 'Ditolak', color: 'bg-gray-500', icon: AlertCircle }
};

export default function OrdersManagement() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    revenue: 0
  });

  useEffect(() => {
    fetchOrders();

    // Real-time subscription
    const channel = supabase
      .channel('orders-management')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders'
        },
        () => {
          if (autoRefresh) {
            fetchOrders();
          }
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchOrders();
      }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    filterOrders();
    calculateStats();
  }, [orders, searchQuery, statusFilter]);

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from('customer_orders')
        .select(`
          *,
          customer_users!customer_orders_user_id_fkey(name, phone),
          rider:customer_users!customer_orders_rider_id_fkey(name, phone),
          order_items:customer_order_items(
            quantity,
            product:products(name)
          )
        `)
        .order('created_at', { ascending: false });

      // Branch filtering
      if (userProfile?.role === 'branch_manager' && userProfile?.branch_id) {
        // Add branch filtering if needed
      }

      const { data, error } = await query;

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Gagal memuat data orders');
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.id.toLowerCase().includes(query) ||
        order.customer_users.name.toLowerCase().includes(query) ||
        order.customer_users.phone.includes(query)
      );
    }

    setFilteredOrders(filtered);
  };

  const calculateStats = () => {
    const total = orders.length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const in_progress = orders.filter(o => 
      ['confirmed', 'preparing', 'on_delivery'].includes(o.status)
    ).length;
    const completed = orders.filter(o => 
      ['delivered', 'completed'].includes(o.status)
    ).length;
    const revenue = orders
      .filter(o => ['delivered', 'completed'].includes(o.status))
      .reduce((sum, o) => sum + o.total_price, 0);

    setStats({ total, pending, in_progress, completed, revenue });
  };

  const handleViewDetail = (orderId: string) => {
    navigate(`/customer-app?tab=order-detail&id=${orderId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-8 w-8 text-primary" />
            Order Management
          </h1>
          <p className="text-muted-foreground">Kelola semua order dari Zeger App</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
          </Button>
          <Button onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              Rp {stats.revenue.toLocaleString('id-ID')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari order ID, customer, atau phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Dikonfirmasi</SelectItem>
                <SelectItem value="preparing">Diproses</SelectItem>
                <SelectItem value="on_delivery">Dalam Pengiriman</SelectItem>
                <SelectItem value="delivered">Terkirim</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders List ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rider</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Tidak ada order
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const StatusIcon = statusConfig[order.status as keyof typeof statusConfig]?.icon || Clock;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">
                        #{order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(order.created_at), 'dd/MM HH:mm')}
                      </TableCell>
                      <TableCell>{order.customer_users.name}</TableCell>
                      <TableCell>{order.customer_users.phone}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {order.order_items.slice(0, 2).map((item, idx) => (
                            <div key={idx}>
                              {item.quantity}x {item.product.name}
                            </div>
                          ))}
                          {order.order_items.length > 2 && (
                            <div className="text-muted-foreground">
                              +{order.order_items.length - 2} lainnya
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        Rp {order.total_price.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[order.status as keyof typeof statusConfig]?.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[order.status as keyof typeof statusConfig]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.rider ? (
                          <div className="text-sm">
                            <div>{order.rider.name}</div>
                            <div className="text-muted-foreground">{order.rider.phone}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetail(order.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
