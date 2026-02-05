import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Eye, Edit, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { Trophy } from "lucide-react";

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
  const { userProfile } = useAuth();
  const canEdit = userProfile && ['ho_admin', 'branch_manager', 'sb_branch_manager'].includes(userProfile.role);
  const canView = userProfile && ['ho_admin', 'branch_manager', 'sb_branch_manager', 'bh_report'].includes(userProfile.role);

  if (!userProfile || !canView) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use Indonesian timezone for dates
  const getJakartaDate = () => {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    return jakartaTime;
  };

  const [category, setCategory] = useState("beban_operasional_harian");
  const [amount, setAmount] = useState<string>("");
  const [assignedUser, setAssignedUser] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date>(getJakartaDate());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Expense[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  
  const [startDate, setStartDate] = useState<Date>(new Date(getJakartaDate().getFullYear(), getJakartaDate().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(getJakartaDate());
  const [riders, setRiders] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSummary, setUserSummary] = useState<{riderId: string, riderName: string, totalExpenses: number, sales: number, percentage: number}[]>([]);
  const [totalOmset, setTotalOmset] = useState(0);

  // Edit/Delete states
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editAssignedUser, setEditAssignedUser] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState<Date>(getJakartaDate());
  const [editNotes, setEditNotes] = useState("");

  const fetchRiders = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['rider', 'sb_rider', 'bh_rider'])
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
    // Format dates to YYYY-MM-DD for proper filtering
    const formatDateForQuery = (date: Date) => {
      // Extract date components directly (consistent with dashboard)
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    const startDateStr = formatDateForQuery(startDate);
    const endDateStr = formatDateForQuery(endDate);
    
    console.log('Filtering expenses from', startDateStr, 'to', endDateStr);
    
    // Load operational_expenses with proper date filtering
    let opQuery = supabase
      .from('operational_expenses')
      .select('id, expense_category, amount, description, expense_date, created_by')
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)
      .order('expense_date', { ascending: false });

    if (selectedUser !== "all") {
      opQuery = opQuery.eq('created_by', selectedUser);
    }

    const { data, error } = await opQuery;

    if (error) {
      toast.error(error.message);
    }

    // Also load rider expenses separately with same date filtering
    let riderQuery = supabase
      .from('daily_operational_expenses')
      .select('id, expense_type, amount, description, expense_date, rider_id, receipt_photo_url')
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)
      .order('expense_date', { ascending: false });

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

    // Calculate summary per user when "all" is selected
    if (selectedUser === "all") {
      const summaryMap: { [key: string]: { name: string; total: number } } = {};
      
      // Aggregate from rider expenses
      (riderExpenses || []).forEach((exp: any) => {
        const rider = riders.find(r => r.id === exp.rider_id);
        if (rider) {
          if (!summaryMap[exp.rider_id]) {
            summaryMap[exp.rider_id] = { name: rider.full_name, total: 0 };
          }
          summaryMap[exp.rider_id].total += Number(exp.amount || 0);
        }
      });
      
      // Aggregate from operational expenses
      (data || []).forEach((exp: any) => {
        const user = allUsers.find(u => u.id === exp.created_by);
        if (user) {
          if (!summaryMap[exp.created_by]) {
            summaryMap[exp.created_by] = { name: user.full_name, total: 0 };
          }
          summaryMap[exp.created_by].total += Number(exp.amount || 0);
        }
      });
      
      const summaryArray = Object.entries(summaryMap)
        .map(([riderId, userData]) => ({
          riderId,
          riderName: userData.name,
          totalExpenses: userData.total,
          sales: 0,
          percentage: 0
        }))
        .sort((a, b) => b.totalExpenses - a.totalExpenses);
      
      // Calculate total sales (omset) for percentage calculation
      const startDateTimeStr = `${startDateStr}T00:00:00+07:00`;
      const endDateTimeStr = `${endDateStr}T23:59:59+07:00`;
      
      // Fetch all transactions for the period to calculate omset per rider
      const { data: transactions } = await supabase
        .from('transactions')
        .select('rider_id, final_amount')
        .eq('status', 'completed')
        .eq('is_voided', false)
        .gte('transaction_date', startDateTimeStr)
        .lte('transaction_date', endDateTimeStr);
      
      // Calculate sales per rider
      const salesByRider: { [key: string]: number } = {};
      let totalSales = 0;
      (transactions || []).forEach(tx => {
        const amount = Number(tx.final_amount || 0);
        totalSales += amount;
        if (tx.rider_id) {
          salesByRider[tx.rider_id] = (salesByRider[tx.rider_id] || 0) + amount;
        }
      });
      
      setTotalOmset(totalSales);
      
      // Update summary with sales data and percentage
      const updatedSummary = summaryArray.map(item => ({
        ...item,
        sales: salesByRider[item.riderId] || 0,
        percentage: totalSales > 0 ? (item.totalExpenses / totalSales) * 100 : 0
      }));
      
      setUserSummary(updatedSummary);
    } else {
      setUserSummary([]);
      setTotalOmset(0);
    }
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
    
    // Get current user profile to get branch_id
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('branch_id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .single();
    
    const selectedUserName = allUsers.find(u => u.id === assignedUser)?.full_name || '';
    
    // Create description combining category, user name, and notes
    let expenseDescription = `${category} - ${selectedUserName}`;
    if (notes.trim()) {
      expenseDescription += ` | Catatan: ${notes.trim()}`;
    }
    
    // Format expense date for database (YYYY-MM-DD)
    const formatDateForDB = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    const { error } = await supabase.from('operational_expenses').insert({
      expense_category: category,
      amount: amt,
      description: expenseDescription,
      expense_date: formatDateForDB(expenseDate),
      created_by: assignedUser,
      branch_id: userProfile?.branch_id
    });
    
    if (error) { 
      toast.error(error.message); 
      return; 
    }
    
    toast.success('Beban ditambahkan');
    setAmount(""); 
    setAssignedUser("");
    setNotes("");
    setExpenseDate(getJakartaDate());
    load();
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditCategory(expense.expense_category);
    setEditAmount(expense.amount.toString());
    setEditExpenseDate(new Date(expense.expense_date));
    
    // Parse notes from description
    const description = expense.description || '';
    const notesMatch = description.match(/\| Catatan: (.+)$/);
    setEditNotes(notesMatch ? notesMatch[1] : '');
    
    // Parse assigned user from description
    const userMatch = description.match(/^[^-]+ - (.+?)(?:\s*\||\s*$)/);
    const userName = userMatch ? userMatch[1] : '';
    const user = allUsers.find(u => u.full_name === userName);
    setEditAssignedUser(user?.id || '');
    
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    const amt = Number(editAmount);
    if (!amt || amt <= 0) {
      toast.error('Jumlah tidak valid');
      return;
    }
    if (!editingExpense) return;

    // Format expense date for database (YYYY-MM-DD)
    const formatDateForDB = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Handle update based on source type
    if ((editingExpense as any).source === 'rider') {
      // Update daily_operational_expenses (rider expense)
      const { error } = await supabase
        .from('daily_operational_expenses')
        .update({
          expense_type: editCategory,
          amount: amt,
          description: editNotes,
          expense_date: formatDateForDB(editExpenseDate)
        })
        .eq('id', editingExpense.id);
      
      if (error) { 
        toast.error(error.message); 
        return; 
      }
    } else {
      // Update operational_expenses (operational expense)
      if (!editAssignedUser) {
        toast.error('Pilih user yang ditugaskan');
        return;
      }

      const selectedUserName = allUsers.find(u => u.id === editAssignedUser)?.full_name || '';
      
      // Create description combining category, user name, and notes
      let expenseDescription = `${editCategory} - ${selectedUserName}`;
      if (editNotes.trim()) {
        expenseDescription += ` | Catatan: ${editNotes.trim()}`;
      }
      
      const { error } = await supabase
        .from('operational_expenses')
        .update({
          expense_category: editCategory,
          amount: amt,
          description: expenseDescription,
          expense_date: formatDateForDB(editExpenseDate),
          created_by: editAssignedUser
        })
        .eq('id', editingExpense.id);
      
      if (error) { 
        toast.error(error.message); 
        return; 
      }
    }
    
    toast.success('Beban berhasil diupdate');
    setIsEditDialogOpen(false);
    setEditingExpense(null);
    load();
  };

  const handleDelete = async (expenseId: string, source?: string) => {
    if (source === 'rider') {
      // Delete from daily_operational_expenses
      const { error } = await supabase
        .from('daily_operational_expenses')
        .delete()
        .eq('id', expenseId);
      
      if (error) { 
        toast.error(error.message); 
        return; 
      }
    } else {
      // Delete from operational_expenses
      const { error } = await supabase
        .from('operational_expenses')
        .delete()
        .eq('id', expenseId);
      
      if (error) { 
        toast.error(error.message); 
        return; 
      }
    }
    
    toast.success('Beban berhasil dihapus');
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
          <div className="space-y-4">
            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = getJakartaDate();
                  setStartDate(today);
                  setEndDate(today);
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = getJakartaDate();
                  const weekStart = new Date(today);
                  weekStart.setDate(today.getDate() - today.getDay());
                  setStartDate(weekStart);
                  setEndDate(today);
                }}
              >
                Weekly
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = getJakartaDate();
                  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                  setStartDate(monthStart);
                  setEndDate(today);
                }}
              >
                Monthly
              </Button>
            </div>

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

            <div className="flex justify-end">
              <Button onClick={load} className="px-6">
                Apply Filter
              </Button>
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

      {/* Tabel Summary per User - ditampilkan jika filter = all */}
      {selectedUser === "all" && userSummary.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-destructive text-destructive-foreground rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Ringkasan Beban Operasional per User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto mt-4">
              {/* Summary info */}
              <div className="mb-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Omset:</span>
                    <span className="ml-2 font-semibold text-primary">{currency.format(totalOmset)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Beban Operasional:</span>
                    <span className="ml-2 font-semibold text-red-600">{currency.format(totalExpenses)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Persentase terhadap Omset:</span>
                    <span className="ml-2 font-semibold text-orange-600">
                      ({totalOmset > 0 ? ((totalExpenses / totalOmset) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
              
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-destructive/10">
                    <th className="text-left p-3 font-semibold">No.</th>
                    <th className="text-left p-3 font-semibold">Nama</th>
                    <th className="text-right p-3 font-semibold">Total Sales</th>
                    <th className="text-right p-3 font-semibold">Total Beban Operasional</th>
                    <th className="text-right p-3 font-semibold">% terhadap Omset</th>
                  </tr>
                </thead>
                <tbody>
                  {userSummary.map((item, index) => (
                    <tr key={item.riderId} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        {index < 3 ? (
                          <span className="flex items-center gap-1">
                            {index + 1}
                            <Trophy className={cn(
                              "h-4 w-4",
                              index === 0 && "text-yellow-500",
                              index === 1 && "text-gray-400",
                              index === 2 && "text-amber-600"
                            )} />
                          </span>
                        ) : (
                          index + 1
                        )}
                      </td>
                      <td className="p-3">{item.riderName}</td>
                      <td className="p-3 text-right font-medium">
                        {currency.format(item.sales)}
                      </td>
                      <td className="p-3 text-right font-medium text-red-600">
                        {currency.format(item.totalExpenses)}
                      </td>
                      <td className="p-3 text-right">
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm font-medium">
                          ({item.percentage.toFixed(1)}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-destructive/10 font-bold">
                    <td colSpan={2} className="p-3">Total</td>
                    <td className="p-3 text-right">
                      {currency.format(totalOmset)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {currency.format(totalExpenses)}
                    </td>
                    <td className="p-3 text-right">
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-medium">
                        ({totalOmset > 0 ? ((totalExpenses / totalOmset) * 100).toFixed(1) : 0}%)
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card>
          <CardHeader><CardTitle>Tambah Beban</CardTitle></CardHeader>
          <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beban_operasional_harian">Beban Operasional Harian</SelectItem>
                  <SelectItem value="beban_gaji_karyawan">Beban Gaji Karyawan</SelectItem>
                  <SelectItem value="beban_sewa">Beban Sewa</SelectItem>
                  <SelectItem value="beban_rumah_tangga">Beban Rumah Tangga</SelectItem>
                  <SelectItem value="beban_lingkungan">Beban Lingkungan</SelectItem>
                  <SelectItem value="beban_lainnya">Beban Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Jumlah</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="cth: 1500000" />
            </div>
            
            <div>
              <Label>Tanggal Beban</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !expenseDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expenseDate ? format(expenseDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={expenseDate}
                    onSelect={(date) => date && setExpenseDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
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
            
            <div className="md:col-span-2">
              <Label>Catatan (Opsional)</Label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Tambahkan catatan untuk beban ini..."
                rows={3}
              />
            </div>
            
            <div className="md:col-span-2">
              <Button onClick={onAdd} className="w-full md:w-auto">Simpan</Button>
            </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                      {new Date(it.expense_date).toLocaleDateString('id-ID', { 
                        timeZone: 'Asia/Jakarta',
                        day: '2-digit',
                        month: '2-digit', 
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {it.receipt_photo_url && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" aria-label="Lihat nota (popup)">
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
                    
                    {/* Edit/Delete buttons - for both operational and rider expenses, for users with edit permissions */}
                    {((it as any).source === 'operational' || (it as any).source === 'rider') && canEdit && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(it)}
                          aria-label="Edit beban"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label="Hapus beban"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Beban</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus beban "{it.expense_category}" senilai {currency.format(it.amount || 0)}? 
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(it.id, (it as any).source)}>
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground">Belum ada data.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Beban Operasional</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Kategori</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Sewa</SelectItem>
                  <SelectItem value="utilities">Listrik/Air</SelectItem>
                  <SelectItem value="salary">Gaji</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="daily_operational">Beban Operasional Harian</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Jumlah</Label>
              <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="cth: 1500000" />
            </div>
            
            <div>
              <Label>Tanggal Beban</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editExpenseDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editExpenseDate ? format(editExpenseDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editExpenseDate}
                    onSelect={(date) => date && setEditExpenseDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Label>Beban ini menjadi beban siapa?</Label>
              <Select value={editAssignedUser} onValueChange={setEditAssignedUser}>
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
            
            <div className="md:col-span-2">
              <Label>Catatan (Opsional)</Label>
              <Textarea 
                value={editNotes} 
                onChange={(e) => setEditNotes(e.target.value)} 
                placeholder="Tambahkan catatan untuk beban ini..."
                rows={3}
              />
            </div>
            
            <div className="md:col-span-2 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleUpdate}>
                Update Beban
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}