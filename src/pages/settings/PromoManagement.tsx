import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Ticket } from 'lucide-react';
import { toast } from 'sonner';

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  promo_type: string;
  scope: string;
  value: number;
  min_purchase: number;
  start_at: string | null;
  end_at: string | null;
  hour_start: number | null;
  hour_end: number | null;
  applicable_branch_ids: string[];
  is_active: boolean;
}

interface Branch { id: string; name: string; }

const PromoManagement = () => {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherTarget, setVoucherTarget] = useState<Promotion | null>(null);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [bulkCount, setBulkCount] = useState('1');

  const [form, setForm] = useState({
    name: '',
    description: '',
    promo_type: 'percentage',
    scope: 'bill',
    value: '',
    min_purchase: '',
    start_at: '',
    end_at: '',
    hour_start: '',
    hour_end: '',
    applicable_branch_ids: [] as string[],
    is_active: true,
  });

  const load = async () => {
    setLoading(true);
    const [p, b] = await Promise.all([
      supabase.from('pos_promotions').select('*').order('created_at', { ascending: false }),
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    ]);
    setPromos((p.data || []) as Promotion[]);
    setBranches((b.data || []) as Branch[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({
      name: '', description: '', promo_type: 'percentage', scope: 'bill',
      value: '', min_purchase: '', start_at: '', end_at: '',
      hour_start: '', hour_end: '', applicable_branch_ids: [], is_active: true,
    });
    setEditing(null);
  };

  const handleEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      promo_type: p.promo_type,
      scope: p.scope,
      value: String(p.value),
      min_purchase: String(p.min_purchase),
      start_at: p.start_at?.slice(0, 16) || '',
      end_at: p.end_at?.slice(0, 16) || '',
      hour_start: p.hour_start != null ? String(p.hour_start) : '',
      hour_end: p.hour_end != null ? String(p.hour_end) : '',
      applicable_branch_ids: p.applicable_branch_ids || [],
      is_active: p.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.value) { toast.error('Nama & nilai wajib'); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      promo_type: form.promo_type,
      scope: form.scope,
      value: Number(form.value),
      min_purchase: Number(form.min_purchase) || 0,
      start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      hour_start: form.hour_start ? Number(form.hour_start) : null,
      hour_end: form.hour_end ? Number(form.hour_end) : null,
      applicable_branch_ids: form.applicable_branch_ids,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from('pos_promotions').update(payload).eq('id', editing.id)
      : await supabase.from('pos_promotions').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Promo tersimpan');
    setOpen(false);
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus promo ini? Voucher terkait juga akan terhapus.')) return;
    const { error } = await supabase.from('pos_promotions').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Promo dihapus');
    load();
  };

  const handleGenerateVouchers = async () => {
    if (!voucherTarget) return;
    const count = Math.max(1, Math.min(500, Number(bulkCount) || 1));
    const codes: string[] = [];
    if (count === 1 && voucherCode.trim()) {
      codes.push(voucherCode.trim().toUpperCase());
    } else {
      const base = (voucherCode.trim() || 'ZGR').toUpperCase().replace(/\s+/g, '');
      for (let i = 0; i < count; i++) {
        const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
        codes.push(`${base}-${rand}`);
      }
    }
    const payload = codes.map((code) => ({ code, promotion_id: voucherTarget.id }));
    const { error } = await supabase.from('pos_vouchers').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`${codes.length} voucher dibuat`);
    setVoucherOpen(false);
    setVoucherCode('');
    setBulkCount('1');
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Promo POS</h1>
          <p className="text-sm text-muted-foreground">Kelola promo dan voucher untuk POS kasir</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Tambah Promo
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Memuat...</div>
      ) : promos.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Belum ada promo</Card>
      ) : (
        <div className="grid gap-3">
          {promos.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    <Badge variant={p.is_active ? 'default' : 'secondary'}>
                      {p.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                    <Badge variant="outline">{p.promo_type}</Badge>
                    <Badge variant="outline">{p.scope}</Badge>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground mb-1">{p.description}</p>}
                  <div className="text-sm">
                    Nilai: <span className="font-semibold">
                      {p.promo_type === 'percentage' ? `${p.value}%` : `Rp${Number(p.value).toLocaleString('id-ID')}`}
                    </span>
                    {p.min_purchase > 0 && (
                      <span className="text-muted-foreground ml-3">
                        Min. Rp{Number(p.min_purchase).toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                  {(p.hour_start != null && p.hour_end != null) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Happy Hour: {p.hour_start}:00 - {p.hour_end}:00
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setVoucherTarget(p); setVoucherOpen(true); }}>
                    <Ticket className="h-3 w-3 mr-1" /> Voucher
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(p)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Promo' : 'Tambah Promo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipe</Label>
                <Select value={form.promo_type} onValueChange={(v) => setForm({ ...form, promo_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (Rp)</SelectItem>
                    <SelectItem value="happy_hour">Happy Hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scope</Label>
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bill">Per Bill</SelectItem>
                    <SelectItem value="item">Per Item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nilai *</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div>
                <Label>Min. Pembelian</Label>
                <Input type="number" value={form.min_purchase} onChange={(e) => setForm({ ...form, min_purchase: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mulai</Label>
                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
              </div>
              <div>
                <Label>Berakhir</Label>
                <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Jam Mulai (0-23)</Label>
                <Input type="number" min={0} max={23} value={form.hour_start} onChange={(e) => setForm({ ...form, hour_start: e.target.value })} />
              </div>
              <div>
                <Label>Jam Berakhir (0-23)</Label>
                <Input type="number" min={0} max={23} value={form.hour_end} onChange={(e) => setForm({ ...form, hour_end: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Cabang Berlaku (kosong = semua)</Label>
              <div className="border rounded p-2 max-h-32 overflow-y-auto space-y-1">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.applicable_branch_ids.includes(b.id)}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          applicable_branch_ids: e.target.checked
                            ? [...form.applicable_branch_ids, b.id]
                            : form.applicable_branch_ids.filter((x) => x !== b.id),
                        });
                      }}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Aktif</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Batal</Button>
              <Button onClick={handleSave} className="flex-1">Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Voucher dialog */}
      <Dialog open={voucherOpen} onOpenChange={setVoucherOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Buat Voucher — {voucherTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Jumlah Voucher</Label>
              <Input type="number" min={1} max={500} value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} />
            </div>
            <div>
              <Label>{Number(bulkCount) > 1 ? 'Prefix Kode' : 'Kode (boleh kosong, akan auto)'}</Label>
              <Input
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder={Number(bulkCount) > 1 ? 'ZGR' : 'PROMO50'}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {Number(bulkCount) > 1
                ? `Akan membuat ${bulkCount} voucher dengan format ${voucherCode || 'ZGR'}-XXXXX`
                : 'Voucher tunggal — gunakan kode unik'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setVoucherOpen(false)} className="flex-1">Batal</Button>
              <Button onClick={handleGenerateVouchers} className="flex-1">Generate</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromoManagement;
