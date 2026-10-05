import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FlowLogo } from '@/components/flow/FlowLogo';
import { Check, MailCheck } from 'lucide-react';
import ecosystemDevices from '@/assets/flow/ecosystem-devices-v2.png.asset.json';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export const TRIAL_DAYS = 14;

const schema = z.object({
  owner_name: z.string().trim().min(2, 'Nama wajib diisi').max(100),
  email: z.string().trim().email('Email tidak valid').max(200),
  phone: z.string().trim().regex(/^[0-9+\s-]{8,20}$/, 'Nomor WhatsApp tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(72),
});

/** Step 1 of the SaaS funnel: create an account that starts a 14-day trial. */
const FlowSignup = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState({ owner_name: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(f);
    if (!r.success) { toast.error(r.error.issues[0].message); return; }
    setSaving(true);
    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
    const { data, error } = await supabase.auth.signUp({
      email: r.data.email, password: r.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { full_name: r.data.owner_name, phone: r.data.phone, flow_tenant: true, flow_plan: params.get('plan') || 'pro', trial_ends_at: trialEnds, onboarded: false },
      },
    });
    setSaving(false);
    if (error) { toast.error(error.message.includes('registered') ? 'Email sudah terdaftar, silakan masuk.' : error.message); return; }
    if (data.session) nav('/onboarding'); else setSent(true);
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?plan=${encodeURIComponent(params.get('plan') || 'pro')}`, queryParams: { prompt: 'select_account' } },
    });
    if (error) toast.error(error.message.includes('provider') ? 'Login Google belum aktif. Silakan hubungi admin untuk mengaktifkannya.' : error.message);
  };

  if (sent) return (
    <div className="flow-site min-h-screen grid place-items-center px-5 flow-hero-glow">
      <div className="flow-card rounded-[32px] p-10 max-w-md text-center">
        <div className="mx-auto h-16 w-16 rounded-full flow-bg-red grid place-items-center"><MailCheck className="h-8 w-8" /></div>
        <h1 className="mt-6 text-2xl font-extrabold flow-ink">Cek email Anda</h1>
        <p className="mt-3 flow-muted">Kami mengirim link verifikasi ke <b>{f.email}</b>. Klik link tersebut, lalu masuk untuk melanjutkan setup bisnis Anda.</p>
        <Link to="/auth" className="flow-btn mt-8 inline-flex rounded-2xl px-6 py-3.5 font-bold">Ke halaman Masuk</Link>
      </div>
    </div>
  );

  return (
    <div className="flow-site min-h-screen flow-hero-glow">
      <header className="max-w-5xl mx-auto px-5 h-20 flex items-center justify-between">
        <Link to="/"><FlowLogo size="sm" /></Link>
        <Link to="/auth" className="text-sm font-semibold flow-ink">Sudah punya akun? Masuk</Link>
      </header>
      <main className="max-w-5xl mx-auto px-5 pb-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <img src={ecosystemDevices.url} alt="FlowF&B di MacBook, iPad, dan iPhone" loading="lazy" className="mb-8 w-full max-w-lg h-auto object-contain drop-shadow-xl" />
          <h1 className="text-4xl md:text-5xl font-extrabold flow-ink leading-tight">Coba gratis <span className="flow-red">{TRIAL_DAYS} hari.</span></h1>
          <p className="mt-4 flow-muted text-lg">Buat akun, setup bisnis Anda, dan langsung jualan. Tanpa kartu kredit.</p>
          <ul className="mt-6 space-y-2.5 flow-ink">
            {['Akses semua modul selama trial', 'Setup menu & outlet dalam 3 menit', 'Pilih paket setelah trial berakhir'].map((t) => (
              <li key={t} className="flex gap-2"><Check className="h-5 w-5 text-success" />{t}</li>
            ))}
          </ul>
        </div>
        <form onSubmit={submit} className="flow-card rounded-[28px] p-8 space-y-4">
          <h2 className="text-2xl font-extrabold flow-ink">Daftar akun</h2>
          <button type="button" onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-background px-6 py-3.5 font-bold flow-ink transition hover:bg-muted/40">
            <GoogleIcon /> Lanjutkan dengan Google
          </button>
          <div className="flex items-center gap-3 text-xs flow-muted">
            <div className="h-px flex-1 bg-border" /><span>atau daftar dengan email</span><div className="h-px flex-1 bg-border" />
          </div>
          {([['owner_name', 'Nama Lengkap', 'text'], ['email', 'Email', 'email'], ['phone', 'No. WhatsApp', 'tel'], ['password', 'Password (min. 8 karakter)', 'password']] as const).map(([k, l, t]) => (
            <label key={k} className="block">
              <span className="text-sm font-semibold flow-ink">{l}</span>
              <input type={t} value={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} className="flow-input mt-1.5 w-full rounded-xl px-4 py-3" autoComplete={k === 'password' ? 'new-password' : undefined} />
            </label>
          ))}
          <button disabled={saving} className="flow-btn w-full rounded-xl px-6 py-3.5 font-bold">{saving ? 'Membuat akun…' : `Mulai Trial ${TRIAL_DAYS} Hari`}</button>
        </form>
      </main>
    </div>
  );
};

export default FlowSignup;
