import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Eye } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

type Expense = {
  id: string;
  expense_category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  source?: string;
  receipt_photo_url?: string | null;
}

export default function OperationalExpenses() {
  const [category, setCategory] = useState("rent");
  const [amount, setAmount] = useState<string>("");
  const [assignedUser, setAssignedUser] = useState("");
  const [items, setItems] = useState<Expense[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  // Use Indonesian timezone for dates
  const getJakartaDate = () => {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    return jakartaTime;
  };
  
  const [startDate, setStartDate] = useState<Date>(new Date(getJakartaDate().getFullYear(), getJakartaDate().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(getJakartaDate());
  const [riders, setRiders] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const fetchRiders = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'rider')
      .eq('is_active', true);
    
    setRiders(data || []);
  };

  const fetchAllUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true);
    
    setAllUsers(data || []);
  };

  const load = async () => {
    // Format dates properly for Jakarta timezone
    const formatDateForQuery = (date: Date) => {
      const jakartaDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      return jakartaDate.toISOString().split('T')[0];
    };
    
    const startDateStr = formatDateForQuery(startDate);
    const endDateStr = formatDateForQuery(endDate);
    
    console.log('Filtering from', startDateStr, 'to', endDateStr);
    
    // Load operational_expenses with date and user filters
    let opQuery = supabase
      .from('operational_expenses')
      .select('id, expense_category, amount, description, expense_date, created_by')
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)
      .order('created_at', { ascending: false });

    if (selectedUser !== "all") {
      opQuery = opQuery.eq('created_by', selectedUser);
    }

    const { data, error } = await opQuery;

    if (error) {
      toast.error(error.message);
    }

    // Also load rider expenses separately
    let riderQuery = supabase
      .from('daily_operational_expenses')
      .select('id, expense_type, amount, description, expense_date, rider_id, receipt_photo_url')
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)
      .order('created_at', { ascending: false });

    if (selectedUser !== "all") {
      riderQuery = riderQuery.eq('rider_id', selectedUser);
    }

    const { data: riderExpenses } = await riderQuery;

    // Combine the data
    const combinedExpenses = [
      ...(data || []).map(item => ({
        id: item.id,
        expense_category: item.expense_category,
        amount: item.amount,
        description: item.description,
        expense_date: item.expense_date,
        source: 'operational'
      })),
      ...(riderExpenses || []).map(item => ({
        id: item.id,
        expense_category: item.expense_type,
        amount: item.amount,
        description: `${item.description} (Rider Expense)`,
        expense_date: item.expense_date,
        source: 'rider',
        receipt_photo_url: item.receipt_photo_url
      }))
    ].sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

    setItems(combinedExpenses as Expense[]);
    
    // Calculate total expenses
    const total = combinedExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    setTotalExpenses(total);
  };

  useEffect(() => { 
    fetchRiders();
    fetchAllUsers();
    load(); 
  }, []);

  useEffect(() => {
    load();
  }, [selectedUser, startDate, endDate]);

  const onAdd = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Jumlah tidak valid');
      return;
    }
    if (!assignedUser) {
      toast.error('Pilih user yang ditugaskan');
      return;
    }
    
    const selectedUserName = allUsers.find(u => u.id === assignedUser)?.full_name || '';
    const expenseDescription = `${category} - ${selectedUserName}`;
    
    const { error } = await supabase.from('operational_expenses').insert({
      expense_category: category,
      amount: amt,
      description: expenseDescription,
      created_by: assignedUser
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Beban ditambahkan');
    setAmount(""); setAssignedUser("");
    load();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Beban Operasional</h1>
        <p className="text-muted-foreground">Catat beban biaya: sewa, listrik, gaji, dll</p>
      </header>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua User</SelectItem>
                  {riders.map((rider) => (
                    <SelectItem key={rider.id} value={rider.id}>
                      {rider.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Tanggal Awal</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Tanggal Akhir</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resume Total Beban</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {currency.format(totalExpenses)}
          </div>
          <p className="text-sm text-muted-foreground">
            Periode {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tambah Beban</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rent">Sewa</SelectItem>
                <SelectItem value="utilities">Listrik/Air</SelectItem>
                <SelectItem value="salary">Gaji</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="maintenance">Perawatan</SelectItem>
                <SelectItem value="other">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Jumlah</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="cth: 1500000" />
          </div>
          <div className="md:col-span-2">
            <Label>Beban ini menjadi beban siapa?</Label>
            <Select value={assignedUser} onValueChange={setAssignedUser}>
              <SelectTrigger><SelectValue placeholder="Pilih user" /></SelectTrigger>
              <SelectContent>
                {allUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4">
            <Button onClick={onAdd}>Simpan</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Riwayat (Termasuk Beban Rider)</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {items.map(it => (
              <div key={it.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium capitalize flex items-center gap-2">
                    {it.expense_category}
                    {(it as any).source === 'rider' && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Rider</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{it.description || '-'}</div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <div className="font-semibold">{currency.format(it.amount || 0)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(it.expense_date + 'T00:00:00+07:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}
                    </div>
                  </div>
                  {it.receipt_photo_url && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Foto Nota - {it.expense_category}</DialogTitle>
                        </DialogHeader>
                        <div className="flex justify-center">
                          <img 
                            src={it.receipt_photo_url} 
                            alt="Foto nota" 
                            className="max-w-full max-h-96 object-contain"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground">Belum ada data.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}