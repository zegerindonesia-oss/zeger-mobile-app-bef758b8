import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZegerLogo } from "@/components/ui/zeger-logo";

const ResetPassword = () => {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    if (window.location.hash.includes("type=recovery")) setReady(true);
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password minimal 6 karakter");
    if (password !== confirm) return toast.error("Konfirmasi password tidak sama");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(`Gagal menyimpan password: ${error.message}`);
    toast.success("Password berhasil diubah. Silakan login.");
    await supabase.auth.signOut();
    window.location.replace("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-600 to-red-800 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <ZegerLogo size="md" className="text-red-600 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Buat Password Baru</h1>
        </div>
        {!ready ? (
          <p className="text-center text-gray-600 text-sm">
            Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link baru dari halaman login.
            <a href="/auth" className="block mt-4 text-red-600 font-medium">Kembali ke Login</a>
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Input type="password" placeholder="Password baru" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-full py-6 px-4" required />
            <Input type="password" placeholder="Ulangi password baru" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-full py-6 px-4" required />
            <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white rounded-full py-6 font-semibold">
              {saving ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
