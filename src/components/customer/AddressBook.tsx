import { useState } from 'react';
import { Check, Home, Briefcase, Loader2, LocateFixed, MapPin, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SavedAddress, reverseGeocode, saveAddresses, setActiveAddress, upsertAddress, useAddresses,
} from '@/lib/customer-addresses';

const LABELS = ['Rumah', 'Kantor', 'Lainnya'];
const iconFor = (l: string) => (l === 'Rumah' ? Home : l === 'Kantor' ? Briefcase : MapPin);

/** Bottom sheet to pick / add / remove saved delivery addresses. */
export function AddressBook({ open, onClose, selectable = true }: { open: boolean; onClose: () => void; selectable?: boolean }) {
  const { list, active } = useAddresses();
  const [form, setForm] = useState<null | { id?: string; label: string; address: string; note: string; lat?: number; lng?: number }>(null);
  const [locating, setLocating] = useState(false);

  if (!open) return null;

  const useCurrent = (intoForm: boolean) => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const address = await reverseGeocode(coords.latitude, coords.longitude);
        if (intoForm) setForm((f) => ({ ...(f || { label: 'Rumah', note: '' }), address, lat: coords.latitude, lng: coords.longitude }));
        else { upsertAddress({ label: 'Lokasi Saat Ini', address, lat: coords.latitude, lng: coords.longitude }, true); onClose(); }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = () => {
    if (!form?.address.trim()) return;
    upsertAddress({ id: form.id, label: form.label, address: form.address.trim(), note: form.note, lat: form.lat, lng: form.lng }, true);
    setForm(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40" onClick={onClose}>
      <div className="cx-app max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-background p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{form ? (form.id ? 'Ubah Alamat' : 'Tambah Alamat') : 'Alamat Tersimpan'}</h3>
          <button onClick={form ? () => setForm(null) : onClose} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {form ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              {LABELS.map((l) => (
                <button key={l} onClick={() => setForm({ ...form, label: l })}
                  className={cn('rounded-full border px-4 py-1.5 text-sm font-semibold', form.label === l ? 'border-zeger bg-zeger-soft text-zeger' : 'border-border')}>{l}</button>
              ))}
            </div>
            <button onClick={() => useCurrent(true)} className="flex items-center gap-2 text-sm font-semibold text-zeger">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} Isi dari lokasi saat ini
            </button>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3}
              placeholder="Alamat lengkap" className="w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-zeger" />
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Patokan / catatan untuk kurir (opsional)" className="w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-zeger" />
            <button onClick={save} disabled={!form.address.trim()} className="cx-btn cx-btn-primary w-full py-3 text-sm disabled:opacity-50">Simpan Alamat</button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectable && (
              <button onClick={() => useCurrent(false)} className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left">
                {locating ? <Loader2 className="h-5 w-5 animate-spin text-zeger" /> : <LocateFixed className="h-5 w-5 text-zeger" />}
                <span className="text-sm font-semibold">Gunakan lokasi saat ini</span>
              </button>
            )}
            {list.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Belum ada alamat tersimpan.</p>}
            {list.map((a: SavedAddress) => {
              const Icon = iconFor(a.label);
              const isActive = active?.id === a.id;
              return (
                <div key={a.id} className={cn('flex items-start gap-3 rounded-2xl border p-3', isActive ? 'border-zeger bg-zeger-soft/50' : 'border-border')}>
                  <button className="flex flex-1 items-start gap-3 text-left" onClick={() => { setActiveAddress(a); if (selectable) onClose(); }}>
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-zeger" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-bold">{a.label}{isActive && <Check className="h-4 w-4 text-zeger" />}</span>
                      <span className="line-clamp-2 block text-xs text-muted-foreground">{a.address}</span>
                      {a.note && <span className="block text-xs italic text-muted-foreground">{a.note}</span>}
                    </span>
                  </button>
                  <button onClick={() => setForm({ id: a.id, label: a.label, address: a.address, note: a.note || '', lat: a.lat, lng: a.lng })} className="text-xs font-semibold text-zeger">Ubah</button>
                  <button onClick={() => saveAddresses(list.filter((x) => x.id !== a.id))} aria-label="Hapus"><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
                </div>
              );
            })}
            <button onClick={() => setForm({ label: 'Rumah', address: '', note: '' })} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zeger py-3 text-sm font-bold text-zeger">
              <Plus className="h-4 w-4" /> Tambah alamat baru
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
