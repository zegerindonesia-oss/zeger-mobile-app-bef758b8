import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FlowLogo } from '@/components/flow/FlowLogo';
import { Coffee, UtensilsCrossed, Croissant, Sandwich, CloudCog, Check, ArrowLeft, ArrowRight, PartyPopper } from 'lucide-react';
import { PLANS, getPlan, formatPrice } from '@/lib/flow-plans';

const TYPES = [
  { id: 'coffee_shop', t: 'Coffee Shop', i: Coffee }, { id: 'restaurant', t: 'Restoran', i: UtensilsCrossed },
  { id: 'bakery', t: 'Bakery', i: Croissant }, { id: 'fast_food', t: 'Fast Food', i: Sandwich },
  { id: 'cloud_kitchen', t: 'Cloud Kitchen', i: CloudCog },
];
const TEMPLATES = [
  { id: 'coffee', t: 'Template Coffee Shop', d: 'Espresso, latte, non-coffee, snack' },
  { id: 'resto', t: 'Template Restoran', d: 'Makanan utama, minuman, dessert' },
  { id: 'bakery', t: 'Template Bakery', d: 'Roti, pastry, cake, minuman' },
  { id: 'manual', t: 'Isi Manual / Upload Excel', d: 'Mulai dari kosong' },
];
const MODULES = [
  { id: 'pos', t: 'POS Kasir', lock: true }, { id: 'table', t: 'Manajemen Meja' }, { id: 'kds', t: 'Kitchen Display' },
  { id: 'queue', t: 'Layar Antrean TV' }, { id: 'bom', t: 'Bahan Baku & Resep' }, { id: 'loyalty', t: 'CRM & Loyalty' },
  { id: 'rider', t: 'Mobile Selling Rider' }, { id: 'customer_app', t: 'Aplikasi Customer' }, { id: 'voice', t: 'Voice AI Kasir' },
];
const STEPS = ['Profil Bisnis', 'Outlet Pertama', 'Menu Awal', 'Pilih Modul'];

const schema = z.object({
  company_name: z.string().trim().min(2, 'Nama bisnis minimal 2 huruf').max(120),
  owner_name: z.string().trim().min(2, 'Nama pemilik wajib diisi').max(100),
  email: z.string().trim().email('Email tidak valid').max(200),
  phone: z.string().trim().regex(/^[0-9+\s-]{8,20}$/, 'Nomor WhatsApp tidak valid'),
  first_outlet_name: z.string().trim().min(2, 'Nama outlet wajib diisi').max(120),
  city: z.string().trim().min(2, 'Kota wajib diisi').max(80),
});

const FlowOnboarding = () => {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const meta = (user?.user_metadata || {}) as Record<string, any>;
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    company_name: '', business_type: 'coffee_shop', outlet_count: '1', owner_name: meta.full_name || '', email: user?.email || '', phone: meta.phone || '',
    first_outlet_name: '', city: '', menu_template: 'coffee',
    modules: ['pos'] as string[], plan: getPlan(meta.flow_plan || params.get('plan')).id as string,
  });
  useEffect(() => { document.title = 'Onboarding | FlowF&B'; }, []);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  const validateStep = () => {
    const r = schema.safeParse(f);
    if (r.success) return true;
    const fields = step === 0 ? ['company_name', 'owner_name', 'email', 'phone'] : step === 1 ? ['first_outlet_name', 'city'] : [];
    const err = r.error.issues.find((i) => fields.includes(i.path[0] as string));
    if (err) { toast.error(err.message); return false; }
    return true;
  };

  const submit = async () => {
    const r = schema.safeParse(f);
    if (!r.success) { toast.error(r.error.issues[0].message); return; }
    setSaving(true);
    const { data: tenantId, error } = await (supabase.rpc as any)('provision_tenant', {
      _company_name: r.data.company_name, _business_type: f.business_type, _plan: f.plan, _modules: f.modules,
      _outlet_name: r.data.first_outlet_name, _city: r.data.city, _phone: r.data.phone, _menu_template: f.menu_template,
    });
    if (error || !tenantId) { setSaving(false); toast.error('Gagal menyiapkan workspace, coba lagi.'); return; }
    // Lead record for the sales team; non-blocking.
    await supabase.from('flow_tenant_signups' as any).insert({ ...f, ...r.data, status: 'provisioned' });
    await supabase.auth.updateUser({ data: { onboarded: true, company_name: r.data.company_name, tenant_id: tenantId } });
    setDone(true);
  };

  const Field = ({ k, label, ph, type = 'text' }: { k: string; label: string; ph?: string; type?: string }) => (
    <label className="block">
      <span className="text-sm font-semibold flow-ink">{label}</span>
      <input type={type} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="flow-input mt-1.5 w-full rounded-xl px-4 py-3" />
    </label>
  );

  if (loading) return null;
  if (!user) return <Navigate to={`/daftar${params.get('plan') ? `?plan=${params.get('plan')}` : ''}`} replace />;

  if (done) return (
    <div className="flow-site min-h-screen grid place-items-center px-5 flow-hero-glow">
      <div className="flow-card rounded-[32px] p-10 max-w-lg text-center">
        <div className="mx-auto h-16 w-16 rounded-full flow-bg-red grid place-items-center"><PartyPopper className="h-8 w-8" /></div>
        <h1 className="mt-6 text-3xl font-extrabold flow-ink">Selamat datang, {f.company_name}!</h1>
        <p className="mt-3 flow-muted">Workspace siap! Outlet "{f.first_outlet_name}"{f.menu_template !== 'manual' ? ' dan menu awal' : ''} sudah dibuat. Trial 14 hari Anda aktif.</p>
        <button onClick={() => { window.location.href = '/'; }} className="flow-btn mt-8 inline-flex rounded-2xl px-6 py-3.5 font-bold">Masuk ke Workspace</button>
      </div>
    </div>
  );

  return (
    <div className="flow-site min-h-screen flow-hero-glow">
      <header className="max-w-5xl mx-auto px-5 h-20 flex items-center justify-between">
        <Link to="/"><FlowLogo size="sm" /></Link>
        <span className="text-sm font-semibold flow-muted">{user.email}</span>
      </header>
      <main className="max-w-3xl mx-auto px-5 pb-20">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'flow-bg-red' : 'bg-border'}`} />
              <div className={`mt-2 text-xs font-semibold ${i === step ? 'flow-red' : 'flow-muted'}`}>{i + 1}. {s}</div>
            </div>
          ))}
        </div>

        <div className="flow-card rounded-[28px] p-8">
          {step === 0 && (
            <div className="space-y-5">
              <h1 className="text-2xl font-extrabold flow-ink">Ceritakan bisnis Anda</h1>
              {Field({ k: "company_name", label: "Nama Brand / Perusahaan", ph: "cth. Kopi Senja" })}
              <div>
                <span className="text-sm font-semibold flow-ink">Jenis Bisnis</span>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {TYPES.map(({ id, t, i: I }) => (
                    <button key={id} type="button" onClick={() => set('business_type', id)} className={`rounded-2xl border border-border p-3 text-center ${f.business_type === id ? 'flow-chip-on' : ''}`}>
                      <I className="h-6 w-6 mx-auto flow-red" /><div className="text-xs font-semibold mt-1.5 flow-ink">{t}</div>
                    </button>
                  ))}
                </div>
              </div>
              <label className="block"><span className="text-sm font-semibold flow-ink">Jumlah Outlet</span>
                <select value={f.outlet_count} onChange={(e) => set('outlet_count', e.target.value)} className="flow-input mt-1.5 w-full rounded-xl px-4 py-3">
                  {['1', '2-5', '6-20', '21-50', '50+'].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                {Field({ k: "owner_name", label: "Nama Pemilik" })}
                {Field({ k: "phone", label: "No. WhatsApp", ph: "08xxxxxxxxxx" })}
              </div>
              {Field({ k: "email", label: "Email Bisnis", type: "email" })}
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <h1 className="text-2xl font-extrabold flow-ink">Outlet pertama Anda</h1>
              {Field({ k: "first_outlet_name", label: "Nama Outlet", ph: "cth. Cabang Kemiri" })}
              {Field({ k: "city", label: "Kota", ph: "cth. Malang" })}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold flow-ink">Mulai dengan menu</h1>
              <div className="grid sm:grid-cols-2 gap-3">
                {TEMPLATES.map((t) => (
                  <button key={t.id} type="button" onClick={() => set('menu_template', t.id)} className={`text-left rounded-2xl border border-border p-4 ${f.menu_template === t.id ? 'flow-chip-on' : ''}`}>
                    <div className="font-bold flow-ink">{t.t}</div><div className="text-sm flow-muted">{t.d}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold flow-ink">Pilih paket</h1>
              <div className="grid sm:grid-cols-2 gap-2">
                {PLANS.map((p) => (
                  <button key={p.id} type="button" onClick={() => set('plan', p.id)} className={`rounded-2xl border border-border p-3 text-left ${getPlan(f.plan).id === p.id ? 'flow-chip-on' : ''}`}>
                    <div className="font-bold flow-ink">{p.name} · {formatPrice(p.price)}{p.price ? '/bln' : ''}</div>
                    <div className="text-xs flow-muted">{p.who}</div>
                  </button>
                ))}
              </div>
              <div className="text-sm font-semibold flow-ink">Modul termasuk</div>
              <div className="grid sm:grid-cols-3 gap-2">
                {MODULES.map((m) => {
                  const on = getPlan(f.plan).modules.includes(m.id);
                  return (
                    <div key={m.id} className={`rounded-2xl border border-border p-3 text-left text-sm font-semibold flex items-center gap-2 ${on ? 'flow-chip-on flow-ink' : 'flow-muted opacity-60'}`}>
                      <span className={`h-5 w-5 rounded-md grid place-items-center ${on ? 'flow-bg-red' : 'border border-border'}`}>{on && <Check className="h-3.5 w-3.5" />}</span>{m.t}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button disabled={step === 0} onClick={() => setStep(step - 1)} className="flow-btn-ghost rounded-xl px-5 py-3 font-bold flex items-center gap-1.5 disabled:opacity-40"><ArrowLeft className="h-4 w-4" />Kembali</button>
            {step < 3 ? (
              <button onClick={() => validateStep() && setStep(step + 1)} className="flow-btn rounded-xl px-6 py-3 font-bold flex items-center gap-1.5">Lanjut<ArrowRight className="h-4 w-4" /></button>
            ) : (
              <button disabled={saving} onClick={submit} className="flow-btn rounded-xl px-6 py-3 font-bold">{saving ? 'Menyimpan…' : 'Selesaikan Pendaftaran'}</button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FlowOnboarding;
