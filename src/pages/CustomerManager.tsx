import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  is_active: boolean;
  created_at: string;
  rider_id: string;
  profiles: {
    full_name: string;
  };
}

export default function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [riders, setRiders] = useState<{ id: string; full_name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRider, setSelectedRider] = useState("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Kelola Pelanggan | Zeger ERP';
    fetchRiders();
    fetchCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm, selectedRider]);

  const fetchRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'rider')
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error('Error fetching riders:', error);
      toast.error('Gagal memuat data rider');
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          profiles!customers_rider_id_fkey (
            full_name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Gagal memuat data pelanggan');
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.address?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by rider
    if (selectedRider !== "all") {
      filtered = filtered.filter(customer => customer.rider_id === selectedRider);
    }

    setFilteredCustomers(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />
          Kelola Pelanggan
        </h1>
        <p className="text-sm text-muted-foreground">
          Daftar pelanggan yang didaftarkan oleh rider
        </p>
      </header>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari nama, telepon, atau alamat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={selectedRider} onValueChange={setSelectedRider}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by rider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Rider</SelectItem>
                  {riders.map((rider) => (
                    <SelectItem key={rider.id} value={rider.id}>
                      {rider.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Pelanggan</p>
                <p className="text-2xl font-bold text-blue-600">{customers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Pelanggan Aktif</p>
                <p className="text-2xl font-bold text-green-600">
                  {customers.filter(c => c.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Rider Terdaftar</p>
                <p className="text-2xl font-bold text-purple-600">{riders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Daftar Pelanggan ({filteredCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm || selectedRider !== "all" 
                ? "Tidak ada pelanggan yang sesuai dengan filter"
                : "Belum ada pelanggan terdaftar"
              }
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{customer.name}</h3>
                        <Badge variant={customer.is_active ? "default" : "secondary"}>
                          {customer.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">{customer.phone || "-"}</p>
                      <p className="text-sm text-gray-500">{customer.address || "-"}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-medium text-sm">{customer.profiles?.full_name}</p>
                    <p className="text-xs text-gray-500">Didaftar oleh</p>
                    <p className="text-xs text-gray-500">{formatDate(customer.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}