import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlowLogo, FlowMark } from "@/components/flow/FlowLogo";
import heroImg from "@/assets/flow/login-hero.jpg";
import { ArrowRight, BarChart3, ChefHat, Eye, EyeOff, Gift, Lock, Mail, Package, Receipt, ShieldCheck, ShoppingCart, Sparkles } from "lucide-react";
const cleanupAuthState = () => {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch {
    // ignore
  }
};
const Auth = () => {
  const {
    user,
    userProfile,
    loading
  } = useAuth();
  const [authLoading, setAuthLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetSending(false);
    if (error) {
      toast.error(`Gagal mengirim link reset: ${error.message}`);
      return;
    }
    toast.success("Link reset password sudah dikirim. Cek inbox / folder spam email Anda.");
    setResetOpen(false);
  };
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: ""
  });
  const [showPw, setShowPw] = useState(false);
  useEffect(() => { document.title = "Masuk | Flow F&B ERP"; }, []);

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (!loading && user && userProfile) {
      const roleRedirects = {
        'rider': '/mobile-seller',
        'sb_rider': '/mobile-seller',
        'bh_rider': '/mobile-seller',
        'customer': '/customer-app',
        'ho_admin': '/',
        'branch_manager': '/',
        'sb_branch_manager': '/',
        'finance': '/',
        'bh_kasir': '/pos',
        'sb_kasir': '/pos',
        '2_Hub_Kasir': '/pos',
        '3_SB_Kasir': '/pos'
      };
      const targetUrl = roleRedirects[userProfile.role as keyof typeof roleRedirects] || '/';
      window.location.replace(targetUrl);
    }
  }, [user, userProfile, loading]);
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      // Clean limbo state then attempt global sign out
      cleanupAuthState();
      try {
        await supabase.auth.signOut({
          scope: 'global'
        });
      } catch {}
      const redirectUrl = `${window.location.origin}/customer-app`;
      const {
        data,
        error
      } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: "customer"
          }
        }
      });
      if (error) throw error;

      // Create profile after signup
      if (data.user) {
        const {
          error: profileError
        } = await supabase.from('profiles').insert({
          user_id: data.user.id,
          full_name: formData.full_name,
          phone: formData.phone,
          role: "customer",
          branch_id: null
        });
        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }
      toast.success("Akun customer berhasil dibuat! Silakan login untuk mengakses aplikasi customer.");
    } catch (error: any) {
      toast.error(error.message || "Gagal membuat akun");
    } finally {
      setAuthLoading(false);
    }
  };
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      // Clean limbo state then attempt global sign out
      cleanupAuthState();
      try {
        await supabase.auth.signOut({
          scope: 'global'
        });
      } catch {}
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });
      if (error) throw error;
      if (data.user) {
        toast.success("Login berhasil!");
        // The useEffect above will handle the redirect based on user role
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal login");
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading || (user && userProfile)) {
    return <div className="flow-site min-h-screen grid place-items-center flow-hero-glow">
        <div className="text-center">
          <FlowMark className="h-14 w-14 mx-auto animate-pulse" />
          <p className="mt-4 flow-muted font-semibold">{loading ? "Memuat..." : "Mengarahkan ke workspace..."}</p>
        </div>
      </div>;
  }

  const features = [
    { i: ShoppingCart, t: "POS Kasir", d: "Cepat, offline-ready" },
    { i: ChefHat, t: "Kitchen Display", d: "Multi-stasiun" },
    { i: Package, t: "Bahan & BOM", d: "HPP otomatis" },
    { i: Gift, t: "CRM & Loyalty", d: "Poin lintas channel" },
    { i: Receipt, t: "PO & Invoice", d: "Jatuh tempo terpantau" },
    { i: BarChart3, t: "Keuangan", d: "Laba rugi real-time" },
  ];
  const inputCls = "h-12 rounded-2xl pl-11 bg-muted/40 border-border focus-visible:ring-primary";

  return <div className="flow-site min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Left: hero */}
      <aside className="relative hidden lg:block overflow-hidden">
        <img src={heroImg} width={1024} height={1344} alt="Owner F&B menggunakan Flow F&B ERP" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/40 to-foreground/10" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <Link to="/landing" className="inline-flex w-fit rounded-2xl bg-background/90 backdrop-blur px-4 py-2.5"><FlowLogo size="sm" /></Link>
          <div className="space-y-6 text-background">
            <span className="inline-flex items-center gap-2 rounded-full bg-background/15 backdrop-blur px-3 py-1.5 text-xs font-bold tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> THE OPERATING SYSTEM FOR F&amp;B
            </span>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.1] max-w-xl">
              Satu sistem untuk seluruh bisnis F&amp;B Anda.
            </h1>
            <p className="text-background/80 max-w-md">Dari kasir, dapur, gudang, sampai laporan keuangan — semua terhubung real-time di Flow F&amp;B ERP.</p>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 max-w-2xl">
              {features.map(({ i: I, t, d }) => (
                <div key={t} className="rounded-2xl bg-background/10 backdrop-blur-md border border-background/20 p-3.5">
                  <I className="h-5 w-5 mb-2" />
                  <div className="text-sm font-bold">{t}</div>
                  <div className="text-xs text-background/70">{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Right: form */}
      <main className="relative flex flex-col flow-hero-glow">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <FlowLogo size="sm" />
        </div>
        <div className="flex-1 grid place-items-center px-5 py-8">
          <div className="w-full max-w-md">
            <div className="hidden lg:block mb-8"><FlowLogo size="md" /></div>
            <h2 className="text-3xl font-extrabold flow-ink">Selamat datang kembali</h2>
            <p className="flow-muted mt-2">Masuk ke workspace Flow F&amp;B ERP Anda.</p>

            <div className="flow-card rounded-[28px] p-6 sm:p-7 mt-7">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email" className="flow-ink font-semibold">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="signin-email" type="email" autoComplete="email" placeholder="nama@bisnis.com" value={formData.email} onChange={e => handleInputChange("email", e.target.value)} className={inputCls} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password" className="flow-ink font-semibold">Password</Label>
                    <button type="button" onClick={() => { setResetEmail(formData.email); setResetOpen(true); }} className="text-xs font-bold flow-red hover:underline">Lupa password?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="signin-password" type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={formData.password} onChange={e => handleInputChange("password", e.target.value)} className={`${inputCls} pr-11`} required />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground" aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}>
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={authLoading} className="flow-btn w-full h-12 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  {authLoading ? "Memproses..." : <>Masuk <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
              <div className="mt-5 flex items-center gap-2 text-xs flow-muted">
                <ShieldCheck className="h-4 w-4 text-primary" /> Akses tampil sesuai hak akses peran Anda.
              </div>
            </div>

            <p className="text-center text-sm flow-muted mt-6">
              Belum punya akun bisnis? <Link to="/daftar" className="font-bold flow-red hover:underline">Coba gratis 7 hari</Link>
            </p>
          </div>
        </div>
        <p className="text-center text-xs flow-muted pb-6">© {new Date().getFullYear()} FlowF&amp;B by Flowstack · Indonesia</p>
      </main>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Lupa Password</DialogTitle>
            <DialogDescription>Masukkan email akun Anda. Kami akan mengirim link untuk membuat password baru.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendReset} className="space-y-4">
            <Input type="email" placeholder="Email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className="h-12 rounded-2xl" required autoFocus />
            <button type="submit" disabled={resetSending} className="flow-btn w-full h-12 rounded-2xl font-bold disabled:opacity-60">
              {resetSending ? "Mengirim..." : "Kirim Link Reset"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Auth;