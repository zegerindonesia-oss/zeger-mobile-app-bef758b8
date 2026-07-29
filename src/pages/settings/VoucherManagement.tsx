import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface V { id: string; code: string; description: string; discount_type: string; discount_value: number; min_order: number; valid_from: string; valid_until: string; is_active: boolean; }

export default function VoucherManagement() {
  const navigate = useNavigate();
  const [items, setItems] = useState<V[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<V> | null>(null);

  useEffect(() => { document.title = 'Voucher Management'; load(); }, []);
  const load = async () => { const { data } = await supabase.from('customer_vouchers').select('*').order('created_at', { ascending: false }); setItems((data as any) || []); };

  const save = async () => {
    if (!edit?.code || !edit?.valid_from || !edit?.valid_until) return toast.error('Lengkapi data');
    const payload = {
      code: edit.code.toUpperCase(), description: edit.description || '',
      discount_type: edit.discount_type || 'percentage', discount_value: edit.discount_value || 0,
      min_order: edit.min_order || 0, valid_from: edit.valid_from, valid_until: edit.valid_until, is_active: edit.is_active ?? true,
    };
    const { error } = edit.id
      ? await supabase.from('customer_vouchers').update(payload).eq('id', edit.id)
      : await supabase.from('customer_vouchers').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Tersimpan'); setOpen(false); setEdit(null); load();
  };
  const remove = async (id: string) => {
    if (!confirm('Hapus voucher ini?')) return;
    const { error } = await supabase.from('customer_vouchers').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/app-management')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">Voucher Management</h1>
        <Button className="ml-auto" onClick={() => { setEdit({ is_active: true, discount_type: 'percentage' }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Tambah</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map(v => (
          <Card key={v.id}><CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-lg">{v.code}</p>
                <p className="text-sm text-gray-600">{v.description}</p>
                <p className="text-sm mt-1">{v.discount_type === 'percentage' ? `${v.discount_value}% OFF` : `Rp ${v.discount_value.toLocaleString('id-ID')} OFF`} · Min Rp {(v.min_order || 0).toLocaleString('id-ID')}</p>
                <p className="text-xs text-gray-500">{v.valid_from} — {v.valid_until}</p>
              </div>
              {!v.is_active && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Nonaktif</span>}
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => { setEdit(v); setOpen(true); }}><Edit className="h-3 w-3 mr-1" />Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="h-3 w-3 mr-1" />Hapus</Button>
            </div>
          </CardContent></Card>
        ))}
        {items.length === 0 && <p className="text-gray-500 text-sm">Belum ada voucher</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit' : 'Tambah'} Voucher</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Kode</Label><Input value={edit?.code || ''} onChange={e => setEdit(x => ({ ...x, code: e.target.value.toUpperCase() }))} /></div>
            <div><Label>Deskripsi</Label><Textarea value={edit?.description || ''} onChange={e => setEdit(x => ({ ...x, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Tipe</Label>
                <Select value={edit?.discount_type || 'percentage'} onValueChange={v => setEdit(x => ({ ...x, discount_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="percentage">Persen (%)</SelectItem><SelectItem value="fixed">Nominal (Rp)</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Nilai</Label><Input type="number" value={edit?.discount_value || 0} onChange={e => setEdit(x => ({ ...x, discount_value: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div><Label>Min Order (Rp)</Label><Input type="number" value={edit?.min_order || 0} onChange={e => setEdit(x => ({ ...x, min_order: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Berlaku Dari</Label><Input type="date" value={edit?.valid_from || ''} onChange={e => setEdit(x => ({ ...x, valid_from: e.target.value }))} /></div>
              <div><Label>Berlaku Sampai</Label><Input type="date" value={edit?.valid_until || ''} onChange={e => setEdit(x => ({ ...x, valid_until: e.target.value }))} /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Aktif</Label><Switch checked={edit?.is_active ?? true} onCheckedChange={v => setEdit(x => ({ ...x, is_active: v }))} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}