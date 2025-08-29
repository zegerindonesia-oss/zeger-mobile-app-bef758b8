import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product { id: string; name: string; category: string; }
interface HubInventory { product_id: string; stock_quantity: number; product?: Product }
interface RiderInventory extends HubInventory { rider_id: string }
interface ReturnMovement { id: string; rider_id: string; product_id: string; quantity: number; status: string; verification_photo_url?: string; created_at: string; product?: Product }
interface Rider { id: string; full_name: string }
interface Shift { 
  id: string; 
  rider_id: string; 
  shift_date: string;
  shift_number: number;
  shift_start_time: string | null; 
  shift_end_time: string | null; 
  total_sales: number;
  cash_collected: number;
  total_transactions: number;
  report_submitted: boolean; 
  report_verified: boolean;
  notes?: string;
}

export default function Inventory() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("stock");
  const [hubInventory, setHubInventory] = useState<HubInventory[]>([]);
  const [riderInventory, setRiderInventory] = useState<RiderInventory[]>([]);
  const [riders, setRiders] = useState<Record<string, Rider>>({});
  const [returns, setReturns] = useState<ReturnMovement[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [depositPhotos, setDepositPhotos] = useState<Record<string, File | undefined>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Inventori | Zeger ERP';
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    fetchData();
  }, [userProfile]);

  const fetchData = async () => {
    try {
      // Hub inventory (branch, rider null)
      const { data: hub } = await supabase
        .from('inventory')
        .select('stock_quantity, product_id, products(id, name, category)')
        .eq('branch_id', userProfile!.branch_id)
        .is('rider_id', null);
      setHubInventory((hub || []).map(i => ({ product_id: i.product_id, stock_quantity: i.stock_quantity, product: (i as any).products })));

      // Rider inventory in branch
      const { data: riderInv } = await supabase
        .from('inventory')
        .select('stock_quantity, product_id, rider_id, products(id, name, category)')
        .eq('branch_id', userProfile!.branch_id)
        .not('rider_id', 'is', null);
      setRiderInventory((riderInv || []).map(i => ({ product_id: i.product_id, stock_quantity: i.stock_quantity, rider_id: (i as any).rider_id, product: (i as any).products })));

      // Riders map
      const { data: riderProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('branch_id', userProfile!.branch_id)
        .eq('role', 'rider');
      const map: Record<string, Rider> = {};
      (riderProfiles || []).forEach(r => { map[r.id] = r as Rider; });
      setRiders(map);

      // Pending returns
      const { data: ret } = await supabase
        .from('stock_movements')
        .select('id, rider_id, product_id, quantity, status, verification_photo_url, created_at, products(id, name, category)')
        .eq('branch_id', userProfile!.branch_id)
        .eq('movement_type', 'return')
        .in('status', ['pending', 'returned'])
        .order('created_at', { ascending: false });
      setReturns((ret || []).map(r => ({ ...r, product: (r as any).products })) as any);

      // Shifts waiting verification
      const today = new Date().toISOString().split('T')[0];
      const { data: sh, error: shiftError } = await supabase
        .from('shift_management')
        .select('id, rider_id, shift_date, shift_number, shift_start_time, shift_end_time, total_sales, cash_collected, total_transactions, report_submitted, report_verified, notes')
        .eq('branch_id', userProfile!.branch_id)
        .eq('shift_date', today)
        .eq('report_submitted', true)
        .eq('report_verified', false);
      
      if (shiftError) {
        console.error('Error fetching shifts:', shiftError);
        setShifts([]);
      } else {
        setShifts(sh || []);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Gagal memuat data inventory');
    }
  };

  const hubTotal = useMemo(() => hubInventory.reduce((s,i)=>s + i.stock_quantity,0), [hubInventory]);
  const riderTotalsByRider = useMemo(() => {
    const m: Record<string, number> = {};
    riderInventory.forEach(i => { m[i.rider_id] = (m[i.rider_id]||0)+ i.stock_quantity; });
    return m;
  }, [riderInventory]);

  const approveReturn = async (movement: ReturnMovement) => {
    if (!userProfile) return;
    setLoading(true);
    try {
      // Approve movement
      await supabase.from('stock_movements').update({ status: 'approved', actual_delivery_date: new Date().toISOString(), notes: 'Return disetujui branch' }).eq('id', movement.id);

      // Decrease rider inventory
      const { data: riderInv } = await supabase
        .from('inventory')
        .select('*')
        .eq('rider_id', movement.rider_id)
        .eq('product_id', movement.product_id)
        .maybeSingle();
      if (riderInv) {
        await supabase.from('inventory').update({ stock_quantity: Math.max(0, riderInv.stock_quantity - movement.quantity), last_updated: new Date().toISOString() }).eq('id', riderInv.id);
      }
      // Increase hub inventory
      const { data: hubInv } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', userProfile.branch_id)
        .eq('product_id', movement.product_id)
        .is('rider_id', null)
        .maybeSingle();
      if (hubInv) {
        await supabase.from('inventory').update({ stock_quantity: hubInv.stock_quantity + movement.quantity, last_updated: new Date().toISOString() }).eq('id', hubInv.id);
      } else {
        await supabase.from('inventory').insert([{ branch_id: userProfile.branch_id, product_id: movement.product_id, stock_quantity: movement.quantity }]);
      }
      toast.success('Pengembalian stok disetujui');
      fetchData();
    } catch (e: any) {
      toast.error('Gagal menyetujui: ' + e.message);
    } finally { setLoading(false); }
  };

  const approveCashDeposit = async (shift: Shift) => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const start = shift.shift_start_time || `${today}T00:00:00`;
      const end = shift.shift_end_time || new Date().toISOString();

      const { data: tx } = await supabase
        .from('transactions')
        .select('final_amount, payment_method')
        .eq('branch_id', userProfile.branch_id)
        .eq('rider_id', shift.rider_id)
        .gte('transaction_date', start)
        .lte('transaction_date', end);
      const cash = (tx||[]).filter(t => (t.payment_method||'').toLowerCase() === 'cash').reduce((s,t:any)=> s + Number(t.final_amount||0), 0);

      // Optional photo upload
      let proofUrl: string | undefined;
      const file = depositPhotos[shift.id];
      if (file) {
        const ext = file.name.split('.').pop();
        const name = `shift-${shift.id}-${Date.now()}.${ext}`;
        const path = `shift-deposits/${userProfile.id}/${name}`;
        const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('payment-proofs').getPublicUrl(path);
        proofUrl = publicUrl;
      }

      // Create financial transaction record
      await supabase.from('financial_transactions').insert([{
        transaction_type: 'asset',
        account_type: 'cash',
        amount: cash,
        description: `Shift cash deposit for shift ${shift.id}${proofUrl ? ' | proof: ' + proofUrl : ''}`,
        branch_id: userProfile.branch_id,
        created_by: userProfile.id,
        reference_number: `SHIFT-${shift.id}`
      }]);

      // Mark shift verified
      await supabase
        .from('shift_management')
        .update({ report_verified: true, verified_by: userProfile.id, verified_at: new Date().toISOString(), cash_collected: cash })
        .eq('id', shift.id);

      toast.success('Setoran tunai diterima');
      setDepositPhotos(prev => ({ ...prev, [shift.id]: undefined }));
      fetchData();
    } catch (e: any) {
      toast.error('Gagal konfirmasi setoran: ' + e.message);
    } finally { setLoading(false); }
  };

  if (!userProfile) return null;

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Inventori</h1>
        <p className="text-sm text-muted-foreground">Pantau stok per cabang / rider.</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stock">Stok Management</TabsTrigger>
          <TabsTrigger value="laporan">Laporan Shift</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Stok Branch Hub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Total stok</p>
                  <p className="text-2xl font-bold">{hubTotal}</p>
                </div>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="hub-detail">
                    <AccordionTrigger>Detail Menu</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {hubInventory.map((i, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span>{i.product?.name}</span>
                            <Badge variant="outline">{i.stock_quantity}</Badge>
                          </div>
                        ))}
                        {hubInventory.length === 0 && (
                          <p className="text-sm text-muted-foreground">Belum ada stok</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Stok Rider</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {Object.keys(riderTotalsByRider).map(rid => (
                    <AccordionItem key={rid} value={rid}>
                      <AccordionTrigger>
                        <div className="flex items-center justify-between w-full">
                          <span>{riders[rid]?.full_name || rid}</span>
                          <Badge variant="secondary">{riderTotalsByRider[rid]} item</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {riderInventory.filter(i => i.rider_id === rid).map((i, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span>{i.product?.name}</span>
                              <Badge variant="outline">{i.stock_quantity}</Badge>
                            </div>
                          ))}
                          {riderInventory.filter(i => i.rider_id === rid).length === 0 && (
                            <p className="text-sm text-muted-foreground">Tidak ada stok</p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                  {Object.keys(riderTotalsByRider).length === 0 && (
                    <p className="text-sm text-muted-foreground">Tidak ada stok rider</p>
                  )}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="laporan">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Konfirmasi Pengembalian Stok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {returns.map(ret => (
                  <div key={ret.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{ret.product?.name}</p>
                        <p className="text-xs text-muted-foreground">Rider: {riders[ret.rider_id]?.full_name || ret.rider_id} • Qty {ret.quantity}</p>
                      </div>
                      <Badge variant="outline">{ret.status}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {ret.verification_photo_url && (
                        <a className="text-xs underline" href={ret.verification_photo_url} target="_blank" rel="noreferrer">Lihat Foto</a>
                      )}
                      <Button size="sm" className="ml-auto" disabled={loading} onClick={() => approveReturn(ret)}>Terima</Button>
                    </div>
                  </div>
                ))}
                {returns.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pengembalian menunggu persetujuan</p>}
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Penerimaan Setoran Tunai</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {shifts.map(s => {
                  const riderCashPhoto = s.notes?.includes('Cash deposit photo:') ? s.notes.split('Cash deposit photo: ')[1] : null;
                  return (
                    <div key={s.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Rider: {riders[s.rider_id]?.full_name || s.rider_id}</h4>
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.shift_date).toLocaleDateString('id-ID')} • Shift {s.shift_number}
                          </p>
                        </div>
                        <Badge variant="secondary">Butuh verifikasi</Badge>
                      </div>
                      
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="details">
                          <AccordionTrigger className="text-sm">Lihat Rincian</AccordionTrigger>
                          <AccordionContent className="space-y-2">
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span>Total Penjualan:</span>
                                <span className="font-medium">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(s.total_sales)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total Transaksi:</span>
                                <span className="font-medium">{s.total_transactions}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1">
                                <span className="font-medium">Total Setoran Tunai:</span>
                                <span className="font-semibold text-green-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(s.cash_collected)}</span>
                              </div>
                            </div>
                            {riderCashPhoto && (
                              <div className="mt-2">
                                <p className="text-xs font-medium mb-1">Foto Setoran dari Rider:</p>
                                <img src={riderCashPhoto} alt="Foto setoran tunai" className="w-full max-w-xs rounded border" />
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                      
                      <div className="flex items-center gap-2">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          placeholder="Foto konfirmasi (opsional)"
                          onChange={(e) => setDepositPhotos(prev => ({ ...prev, [s.id]: e.target.files?.[0] }))} 
                        />
                        <Button size="sm" disabled={loading} onClick={() => approveCashDeposit(s)}>
                          Terima
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {shifts.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada shift menunggu verifikasi</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
