import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FlowLogo } from '@/components/flow/FlowLogo';
import { Check, MailCheck } from 'lucide-react';

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
