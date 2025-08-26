import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserPlus, 
  Phone,
  MapPin,
  Calendar,
  Edit
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  created_at: string;
  is_active: boolean;
}

interface NewCustomer {
  name: string;
  phone: string;
  address: string;
}

export const CustomerManagement = () => {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>({
    name: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      if (!userProfile?.id) return;

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('rider_id', userProfile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data pelanggan");
    }
  };

  const createOrUpdateCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast.error("Nama pelanggan wajib diisi");
      return;
    }

    if (!userProfile?.id) return;

    setLoading(true);
    try {
      const customerData = {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || null,
        address: newCustomer.address.trim() || null,
        rider_id: userProfile.id,
        branch_id: userProfile.branch_id,
        is_active: true
      };

      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);

        if (error) throw error;
        toast.success("Data pelanggan berhasil diperbarui!");
      } else {
        // Create new customer
        const { error } = await supabase
          .from('customers')
          .insert([customerData]);

        if (error) throw error;
        toast.success("Pelanggan baru berhasil ditambahkan!");
      }

      setDialogOpen(false);
      setEditingCustomer(null);
      setNewCustomer({
        name: '',
        phone: '',
        address: ''
      });
      fetchCustomers();
    } catch (error: any) {
      toast.error("Gagal menyimpan data pelanggan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const editCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setNewCustomer({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || ''
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setNewCustomer({
      name: '',
      phone: '',
      address: ''
    });
  };

  return (
    <div className="space-y-6">
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manajemen Pelanggan
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Tambah Pelanggan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-red-600">Nama Pelanggan *</label>
                    <Input
                      placeholder="Masukkan nama pelanggan"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer(prev => ({...prev, name: e.target.value}))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">No. Telepon</label>
                    <Input
                      placeholder="Masukkan nomor telepon"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer(prev => ({...prev, phone: e.target.value}))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Alamat</label>
                    <Textarea
                      placeholder="Masukkan alamat pelanggan"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer(prev => ({...prev, address: e.target.value}))}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={createOrUpdateCustomer} disabled={loading} className="flex-1">
                      {loading ? "Menyimpan..." : (editingCustomer ? "Update Pelanggan" : "Tambah Pelanggan")}
                    </Button>
                    <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                      Batal
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {customers.map((customer) => (
                <div key={customer.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-lg">{customer.name}</h4>
                        <Badge variant="secondary">
                          Aktif
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            <span>{customer.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>Terdaftar: {new Date(customer.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editCustomer(customer)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {customers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada data pelanggan</p>
                  <p className="text-sm">Tambahkan pelanggan baru untuk memulai</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};