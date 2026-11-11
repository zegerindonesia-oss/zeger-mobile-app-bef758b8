import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Read-only shell for branch partners (sb_report): only sales reports, no back-office menus.
export default function BranchReportLayout({ children }: { children: ReactNode }) {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const logout = async () => { await supabase.auth.signOut(); navigate("/auth"); };
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Laporan Cabang · Mitra</p>
          <h1 className="text-lg font-bold text-foreground">{userProfile?.full_name || "Mitra"}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Keluar</Button>
      </header>
      <main className="mx-auto max-w-7xl p-3 md:p-6">{children}</main>
    </div>
  );
}
