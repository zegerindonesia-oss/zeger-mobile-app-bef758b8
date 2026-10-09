import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ZegerLogo } from '@/components/ui/zeger-logo';
import { useToast } from '@/hooks/use-toast';
import { cxArt } from '@/lib/customer-art';
import { cn } from '@/lib/utils';
import {
  Eye, EyeOff, Mail, Lock, User, Phone, MapPin, ArrowLeft, Loader2,
  Coffee, Gift, Crown, ShieldCheck,
} from 'lucide-react';

interface CustomerAuthProps {
  onAuthSuccess: () => void;
}

type AuthMode = 'login' | 'register' | 'complete-profile' | 'forgot';

const PERKS = [
  { icon: Coffee, label: 'Pesan di semua kanal Zeger' },
  { icon: Gift, label: 'Poin & voucher berlaku di mana saja' },
  { icon: Crown, label: 'Benefit MyZeger Plan' },
];

/** Shared text field with the soft inset look used across the customer app. */
function Field({
  id, label, icon: Icon, trailing, ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string; label: string; icon: React.ElementType; trailing?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block pl-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zeger" />
        <input
          id={id}
          {...rest}
          className={cn(
            'h-12 w-full rounded-2xl border border-[hsl(var(--cx-line))] bg-white pl-11 pr-11 text-sm font-semibold text-foreground',
            'shadow-[inset_0_2px_4px_hsl(var(--cx-shadow)/0.08)] outline-none transition',
            'placeholder:font-medium placeholder:text-muted-foreground/70',
            'focus:border-zeger focus:shadow-[inset_0_2px_4px_hsl(var(--cx-shadow)/0.06),0_0_0_4px_hsl(var(--zeger)/0.14)]',
          )}
        />
        {trailing}
      </div>
    </div>
  );
}

export function CustomerAuth({ onAuthSuccess }: CustomerAuthProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    address: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          toast({
            title: 'Email belum diverifikasi',
            description: 'Buka email dari Zeger lalu klik tautan verifikasi.',
            variant: 'destructive',
            duration: 8000,
          });
          setLoading(false);
          return;
        }
        throw error;
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('customer_users')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          setMode('complete-profile');
        } else if (profileError) {
          throw profileError;
        } else {
          void profile;
          onAuthSuccess();
        }
      }
    } catch (error: any) {
      toast({
        title: 'Gagal masuk',
        description: error.message === 'Invalid login credentials'
          ? 'Email atau kata sandi salah.'
          : error.message || 'Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({ title: 'Kata sandi tidak sama', description: 'Ulangi konfirmasi kata sandi.', variant: 'destructive' });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: 'Kata sandi terlalu pendek', description: 'Minimal 6 karakter.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/customer-app`,
        },
      });

      if (error) throw error;

      if (data.user && !data.session) {
        setUnconfirmedEmail(formData.email);
        setEmailSent(true);
      } else if (data.user && data.session) {
        setMode('complete-profile');
        toast({ title: 'Akun dibuat', description: 'Lengkapi profil untuk mulai memesan.' });
      }
    } catch (error: any) {
      toast({
        title: 'Gagal mendaftar',
        description: error.message?.includes('already registered')
          ? 'Email ini sudah terdaftar. Silakan masuk.'
          : error.message || 'Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi berakhir, silakan masuk ulang');

      const { error } = await supabase
        .from('customer_users')
        .upsert({
          user_id: user.id,
          email: formData.email || user.email,
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          role: 'customer',
          points: 0,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({ title: 'Selamat datang di Zeger!', description: 'Profil kamu sudah siap.' });
      onAuthSuccess();
    } catch (error: any) {
      toast({ title: 'Gagal menyimpan profil', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (error: any) {
      toast({ title: 'Gagal mengirim tautan', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(v => !v)}
      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition active:scale-90"
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  const submitLabel = (busy: string, idle: string) =>
    loading ? (<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{busy}</span>) : idle;

  const renderLogin = () => (
    <form onSubmit={handleLogin} className="space-y-4">
      <Field
        id="email" label="Email" icon={Mail} type="email" inputMode="email" autoComplete="email"
        value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)}
        placeholder="nama@email.com" required
      />
      <Field
        id="password" label="Kata sandi" icon={Lock} type={showPassword ? 'text' : 'password'}
        autoComplete="current-password" value={formData.password}
        onChange={(e) => handleInputChange('password', e.target.value)}
        placeholder="••••••••" required trailing={passwordToggle}
      />

      <button
        type="button"
        onClick={() => { setResetSent(false); setMode('forgot'); }}
        className="block w-full text-right text-xs font-bold text-zeger"
      >
        Lupa kata sandi?
      </button>

      <button type="submit" disabled={loading} className="cx-btn cx-btn-primary w-full py-3.5 text-sm">
        {submitLabel('Memproses…', 'Masuk')}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Belum punya akun?{' '}
        <button type="button" onClick={() => setMode('register')} className="font-bold text-zeger">
          Daftar sekarang
        </button>
      </p>
    </form>
  );

  const renderRegister = () => (
    <form onSubmit={handleRegister} className="space-y-4">
      <Field
        id="reg-email" label="Email" icon={Mail} type="email" inputMode="email" autoComplete="email"
        value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)}
        placeholder="nama@email.com" required
      />
      <Field
        id="reg-password" label="Kata sandi" icon={Lock} type={showPassword ? 'text' : 'password'}
        autoComplete="new-password" value={formData.password}
        onChange={(e) => handleInputChange('password', e.target.value)}
        placeholder="Minimal 6 karakter" required trailing={passwordToggle}
      />
      <Field
        id="reg-confirm" label="Ulangi kata sandi" icon={ShieldCheck} type="password" autoComplete="new-password"
        value={formData.confirmPassword} onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
        placeholder="••••••••" required
      />

      <button type="submit" disabled={loading} className="cx-btn cx-btn-primary w-full py-3.5 text-sm">
        {submitLabel('Mendaftarkan…', 'Buat akun')}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Sudah punya akun?{' '}
        <button type="button" onClick={() => setMode('login')} className="font-bold text-zeger">
          Masuk di sini
        </button>
      </p>
    </form>
  );

  const renderCompleteProfile = () => (
    <form onSubmit={handleCompleteProfile} className="space-y-4">
      <Field
        id="name" label="Nama lengkap" icon={User} type="text" autoComplete="name"
        value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)}
        placeholder="Nama kamu" required
      />
      <Field
        id="phone" label="Nomor WhatsApp" icon={Phone} type="tel" inputMode="tel" autoComplete="tel"
        value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)}
        placeholder="08xxxxxxxxxx" required
      />
      <Field
        id="address" label="Alamat" icon={MapPin} type="text" autoComplete="street-address"
        value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)}
        placeholder="Alamat pengantaran" required
      />

      <button type="submit" disabled={loading} className="cx-btn cx-btn-primary w-full py-3.5 text-sm">
        {submitLabel('Menyimpan…', 'Mulai pesan')}
      </button>
    </form>
  );

  const renderForgot = () => (
    resetSent ? (
      <div className="space-y-5 text-center">
        <img src={cxArt.gift} alt="" className="cx-art mx-auto h-24 w-24" />
        <div className="space-y-2">
          <h3 className="text-lg font-extrabold">Tautan terkirim</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Kami kirim tautan ganti kata sandi ke <span className="font-bold text-foreground">{formData.email}</span>.
            Cek inbox atau folder spam, lalu buka tautannya dari HP ini.
          </p>
        </div>
        <button type="button" onClick={() => { setResetSent(false); setMode('login'); }} className="cx-btn cx-btn-primary w-full py-3.5 text-sm">
          Kembali ke halaman masuk
        </button>
      </div>
    ) : (
      <form onSubmit={handleForgot} className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Masukkan email akunmu. Kami kirim tautan untuk membuat kata sandi baru.
        </p>
        <Field
          id="forgot-email" label="Email" icon={Mail} type="email" inputMode="email"
          value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)}
          placeholder="nama@email.com" required
        />
        <button type="submit" disabled={loading} className="cx-btn cx-btn-primary w-full py-3.5 text-sm">
          {submitLabel('Mengirim…', 'Kirim tautan')}
        </button>
        <button type="button" onClick={() => setMode('login')} className="cx-btn cx-btn-ghost w-full py-3 text-sm">
          Batal
        </button>
      </form>
    )
  );

  const renderEmailSent = () => (
    <div className="space-y-5 text-center">
      <div className="cx-stage mx-auto flex h-24 w-24 items-center justify-center rounded-[28px]">
        <Mail className="h-10 w-10 text-zeger" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-extrabold">Cek email kamu</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Tautan verifikasi dikirim ke
        </p>
        <p className="text-sm font-extrabold text-zeger">{unconfirmedEmail}</p>
        <p className="px-2 text-xs leading-relaxed text-muted-foreground">
          Buka tautan itu untuk mengaktifkan akun. Kalau tidak ada di inbox, cek folder spam.
        </p>
      </div>

      <div className="space-y-2 pt-1">
        <button onClick={() => { setEmailSent(false); setMode('login'); }} className="cx-btn cx-btn-primary w-full py-3.5 text-sm">
          Kembali ke halaman masuk
        </button>
        <button
          onClick={() => {
            setEmailSent(false);
            setMode('register');
            setFormData(prev => ({ ...prev, email: '', password: '', confirmPassword: '' }));
          }}
          className="cx-btn cx-btn-ghost w-full py-3 text-sm"
        >
          Daftar dengan email lain
        </button>
      </div>
    </div>
  );

  const heading =
    emailSent ? 'Verifikasi email'
      : mode === 'login' ? 'Selamat datang kembali'
      : mode === 'register' ? 'Gabung Zeger'
      : mode === 'forgot' ? 'Lupa kata sandi'
      : 'Lengkapi profil';

  const subheading =
    emailSent ? 'Satu langkah lagi'
      : mode === 'login' ? 'Masuk untuk pesan & kumpulkan poin'
      : mode === 'register' ? 'Buat akun dalam satu menit'
      : mode === 'forgot' ? 'Kami bantu pulihkan akunmu'
      : 'Supaya pesananmu sampai dengan tepat';

  const canGoBack = !emailSent && (mode === 'register' || mode === 'forgot');

  return (
    <div className="cx-app min-h-screen bg-[hsl(var(--cx-canvas))]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        {/* Brand header */}
        <header className="relative overflow-hidden rounded-b-[34px] bg-gradient-to-br from-zeger-dark via-zeger to-[hsl(355_72%_52%)] px-6 pb-16 pt-10 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-black/20 blur-2xl" />

          {canGoBack && (
            <button
              onClick={() => setMode('login')}
              aria-label="Kembali"
              className="relative mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition active:scale-90"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div className="relative flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white shadow-[0_12px_24px_-10px_rgba(0,0,0,.5)]">
              <ZegerLogo size="sm" className="w-11" />
            </div>
            <div className="min-w-0">
              <h1 className="cx-display text-2xl font-extrabold leading-tight">{heading}</h1>
              <p className="mt-0.5 text-xs text-white/85">{subheading}</p>
            </div>
          </div>

          <img
            src={cxArt.cupIced}
            alt=""
            aria-hidden
            className="cx-art cx-float pointer-events-none absolute -bottom-2 right-3 h-28 w-28 opacity-95"
          />
        </header>

        {/* Form card */}
        <main className="-mt-10 flex-1 px-5 pb-10">
          <div className="cx-card cx-rise rounded-[28px] p-5">
            {emailSent ? renderEmailSent() : (
              <>
                {mode === 'login' && renderLogin()}
                {mode === 'register' && renderRegister()}
                {mode === 'complete-profile' && renderCompleteProfile()}
                {mode === 'forgot' && renderForgot()}
              </>
            )}
          </div>

          {!emailSent && mode !== 'complete-profile' && (
            <ul className="mt-6 space-y-2.5">
              {PERKS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                  <span className="cx-stage flex h-9 w-9 items-center justify-center rounded-2xl text-zeger">
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            Dengan melanjutkan kamu setuju pada Syarat Layanan & Kebijakan Privasi Zeger.
          </p>
        </main>
      </div>
    </div>
  );
}
