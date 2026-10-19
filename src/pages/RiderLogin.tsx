import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import zegerLogo from "@/assets/zeger-logo.png.asset.json";

const RIDER_ROLES = ["rider", "sb_rider", "bh_rider"];

export default function RiderLogin() {
  const { user, userProfile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && userProfile) {
      window.location.replace(RIDER_ROLES.includes(userProfile.role) ? "/mobile-seller" : "/");
    }
  }, [user, userProfile, loading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message || "Gagal masuk");
    else toast.success("Selamat bertugas!");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary to-primary/80 p-6">
      <img src={(zegerLogo as any).url} alt="Zeger" className="h-20 w-auto mb-3 drop-shadow-lg" />
      <h1 className="text-2xl font-bold text-primary-foreground">Zeger Rider</h1>
      <p className="text-primary-foreground/80 text-sm mb-8">On The Wheels — masuk untuk mulai shift</p>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl bg-background p-6 shadow-2xl">
        <Input type="email" placeholder="Email rider" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Kata sandi" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full h-12 rounded-2xl text-base" disabled={busy || loading}>
          {busy ? "Memproses..." : "Masuk"}
        </Button>
      </form>
    </div>
  );
}
