import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/shared/ImageUpload';

interface Plan { id: string; name: string; description: string | null; price: number; quota: number; period_days: number; image_url: string | null; is_active: boolean; }

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);

  useEffect(() => { document.title = 'Subscription Plans'; load(); }, []);
  const load = async () => { const { data } = await supabase.from('subscription_plans').select('*').order('created_at', { ascending: false }); setItems((data as any) || []); };

  const save = async () => {
    if (!edit?.name) return toast.error('Nama wajib');
    const payload = { name: edit.name, description: edit.description || null, price: edit.price || 0, quota: edit.quota || 0, period_days: edit.period_days || 30, image_url: edit.image_url || null, is_active: edit.is_active ?? true };
    const { error } = edit.id
      ? await supabase.from('subscription_plans').update(payload).eq('id', edit.id)
      : await supabase.from('subscription_plans').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Tersimpan'); setOpen(false); setEdit(null); load();
  };
  const remove = async (id: string) => {
    if (!confirm('Hapus paket ini?')) return;
    const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/app-management')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <Button className="ml-auto" onClick={() => { setEdit({ is_active: true, period_days: 30 }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Tambah</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map(p => (
          <Card key={p.id}><CardContent className="p-4">
            <div className="flex items-start gap-3">
              {p.image_url && <img src={p.image_url} className="w-20 h-20 rounded-lg object-cover" alt="" />}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{p.name}</p>
                  {!p.is_active && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Nonaktif</span>}
                </div>
                <p className="text-sm text-gray-600">{p.description}</p>
                <p className="text-sm mt-1">Rp {p.price.toLocaleString('id-ID')} · {p.quota} kuota · {p.period_days} hari</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => { setEdit(p); setOpen(true); }}><Edit className="h-3 w-3 mr-1" />Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3 mr-1" />Hapus</Button>
                </div>
              </div>
            </div>
          </CardContent></Card>
        ))}
        {items.length === 0 && <p className="text-gray-500 text-sm">Belum ada paket</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit' : 'Tambah'} Paket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={edit?.name || ''} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} /></div>
            <div><Label>Deskripsi</Label><Textarea value={edit?.description || ''} onChange={e => setEdit(x => ({ ...x, description: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Harga</Label><Input type="number" value={edit?.price || 0} onChange={e => setEdit(x => ({ ...x, price: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Kuota</Label><Input type="number" value={edit?.quota || 0} onChange={e => setEdit(x => ({ ...x, quota: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Hari</Label><Input type="number" value={edit?.period_days || 30} onChange={e => setEdit(x => ({ ...x, period_days: parseInt(e.target.value) || 30 }))} /></div>
            </div>
            <div><Label>Gambar</Label><ImageUpload value={edit?.image_url || ''} onChange={url => setEdit(x => ({ ...x, image_url: url }))} bucket="product-images" folder="subscription" /></div>
            <div className="flex items-center justify-between"><Label>Aktif</Label><Switch checked={edit?.is_active ?? true} onCheckedChange={v => setEdit(x => ({ ...x, is_active: v }))} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}