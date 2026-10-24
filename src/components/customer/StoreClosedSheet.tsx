import { Moon } from 'lucide-react';

export function StoreClosedSheet({ open, onClose, openTime, closeTime }: { open: boolean; onClose: () => void; openTime: string; closeTime: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-card px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zeger-soft">
          <Moon className="h-6 w-6 text-zeger" />
        </div>
        <h2 className="text-base font-semibold">Mohon Maaf, Semua Store Sedang Tutup</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Kami siap melayanimu kembali saat store buka.</p>
        <p className="mt-3 inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium">Jam buka {openTime} – {closeTime} WIB</p>
        <button onClick={onClose} className="cx-btn cx-btn-primary mt-5 w-full py-3 text-sm">Oke, mengerti</button>
      </div>
    </div>
  );
}
