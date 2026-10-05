import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlowLogo } from '@/components/flow/FlowLogo';
import { Clock, Lock, ShoppingCart, Monitor, Package, Gift, BarChart3, LogOut } from 'lucide-react';

export const trialDaysLeft = (endsAt?: string) => {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));
};

/** Home for self-serve FlowF&B tenants: trial status, and a paywall once the trial ends. */
const FlowWorkspace = () => {
  const { user } = useAuth();
  const meta = (user?.user_metadata || {}) as Record<string, any>;
  const left = trialDaysLeft(meta.trial_ends_at);
  const expired = meta.subscription_status !== 'active' && left <= 0;
  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/'; };

  return (
    <div className="flow-site min-h-screen flow-hero-glow">
      <header className="max-w-6xl mx-auto px-5 h-20 flex items-center justify-between">
        <FlowLogo size="sm" />
        <button onClick={logout} className="flow-btn-ghost rounded-full px-4 py-2 text-sm font-bold flex items-center gap-2"><LogOut className="h-4 w-4" />Keluar</button>
      </header>
      <main className="max-w-6xl mx-auto px-5 pb-20">
        {expired ? (
          <div className="flow-card rounded-[32px] p-10 max-w-xl mx-auto text-center mt-10">
            <div className="mx-auto h-16 w-16 rounded-full flow-bg-red grid place-items-center"><Lock className="h-8 w-8" /></div>
            <h1 className="mt-6 text-3xl font-extrabold flow-ink">Masa trial telah berakhir</h1>
            <p className="mt-3 flow-muted">Pilih paket untuk melanjutkan akses ke POS, back office, dan seluruh data bisnis Anda. Data Anda tetap aman.</p>
            <Link to="/harga" className="flow-btn mt-8 inline-flex rounded-2xl px-6 py-3.5 font-bold">Pilih Paket</Link>
          </div>
        ) : (
          <>
            <div className="flow-card rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl flow-bg-red grid place-items-center"><Clock className="h-6 w-6" /></div>
                <div>
                  <div className="font-extrabold flow-ink">Trial aktif — sisa {left} hari</div>
                  <div className="text-sm flow-muted">Berakhir {new Date(meta.trial_ends_at).toLocaleDateString('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' })}</div>
                </div>
              </div>
              <Link to="/harga" className="flow-btn rounded-full px-5 py-2.5 font-bold text-sm">Upgrade Sekarang</Link>
            </div>
            <h1 className="mt-10 text-3xl font-extrabold flow-ink">Halo, {meta.full_name || 'Owner'} 👋</h1>
            <p className="flow-muted mt-1">Workspace bisnis Anda sedang disiapkan. Modul yang tersedia:</p>
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[{ i: ShoppingCart, t: 'POS Kasir' }, { i: Monitor, t: 'Kitchen Display' }, { i: Package, t: 'Bahan Baku & Resep' }, { i: Gift, t: 'CRM & Loyalty' }, { i: BarChart3, t: 'Laporan Keuangan' }].map(({ i: I, t }) => (
                <div key={t} className="flow-card rounded-3xl p-6">
                  <div className="h-12 w-12 rounded-2xl flow-soft grid place-items-center"><I className="h-6 w-6 flow-red" /></div>
                  <div className="mt-4 font-extrabold flow-ink">{t}</div>
                  <div className="text-sm flow-muted">Aktivasi oleh tim FlowF&B dalam 1×24 jam.</div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default FlowWorkspace;
