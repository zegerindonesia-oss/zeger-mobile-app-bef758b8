import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Armchair, Gift, Smartphone, Star, Loader2 } from 'lucide-react';
import { ANDROID_APP_URL, saveTableContext } from '@/lib/table-qr';

/**
 * Smart hybrid table QR landing: guests can order instantly on the web,
 * while a points/voucher hook nudges them to install the app.
 */
const TableLanding = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const branchId = params.get('b') || '';
  const table = params.get('t') || '';
  const [info, setInfo] = useState<{ branch_name: string; branch_address: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!branchId || !table) { setError('QR meja tidak valid.'); return; }
    (supabase as any).rpc('get_table_qr_info', { _branch_id: branchId, _table: table }).then(({ data, error }: any) => {
      const row = data?.[0];
      if (error || !row) return setError('Outlet tidak ditemukan.');
      setInfo(row);
      saveTableContext({ branchId, branchName: row.branch_name, branchAddress: row.branch_address || '', table });
      navigate('/customer-app', { replace: true });
    });
  }, [branchId, table, navigate]);

  const openApp = () => {
    // Opens the installed app via its custom scheme; falls back to the store.
    const t = setTimeout(() => (window.location.href = ANDROID_APP_URL), 1500);
    window.addEventListener('blur', () => clearTimeout(t), { once: true });
    window.location.href = `zeger://table?b=${branchId}&t=${encodeURIComponent(table)}`;
  };

  if (error) return <div className="min-h-screen grid place-items-center p-6 text-center text-muted-foreground">{error}</div>;
  if (!info) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-zeger text-primary-foreground px-6 pt-10 pb-8 text-center">
        <Armchair className="mx-auto h-8 w-8 opacity-90" />
        <p className="mt-2 text-sm opacity-90">{info.branch_name}</p>
        <h1 className="mt-1 text-4xl font-bold">Meja {table}</h1>
        <p className="mt-1 text-xs opacity-80">Pesan langsung dari meja, pesanan diantar ke mejamu</p>
      </div>

      <div className="flex-1 p-5 space-y-4 max-w-md w-full mx-auto">
        <Button className="w-full h-12 text-base" onClick={() => navigate('/customer-app')}>
          Pesan Sekarang di Sini
        </Button>

        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm"><Gift className="h-4 w-4 text-primary" /> Lebih untung di Aplikasi Zeger</div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex gap-2"><Star className="h-4 w-4 shrink-0 text-primary" /> Kumpulkan poin dari pesanan meja ini</li>
            <li className="flex gap-2"><Star className="h-4 w-4 shrink-0 text-primary" /> Tukar poin dengan menu gratis & voucher</li>
            <li className="flex gap-2"><Star className="h-4 w-4 shrink-0 text-primary" /> Promo khusus member setiap minggu</li>
          </ul>
          <Button variant="outline" className="w-full" onClick={openApp}>
            <Smartphone className="h-4 w-4 mr-2" /> Buka / Download Aplikasi
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Masuk dengan nomor HP agar poin otomatis tersimpan ke akun member.</p>
      </div>
    </div>
  );
};

export default TableLanding;
