import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserCog, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RiderReassignment() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [riderEmail, setRiderEmail] = useState("");
  const [targetBranch, setTargetBranch] = useState("");
  const [setSbRider, setSetSbRider] = useState(true);
  const [result, setResult] = useState<any>(null);

  // Quick action state for Z-009 and Z-011
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);

  const handleReassign = async () => {
    if (!riderEmail.trim() || !targetBranch.trim()) {
      toast.error("Email rider dan nama branch harus diisi");
      return;
    }

    setLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('reassign-rider-branch', {
        body: {
          rider_email: riderEmail.trim(),
          target_branch_name: targetBranch.trim(),
          set_role_to_sb_rider: setSbRider
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message);
        setResult(data);
        setRiderEmail("");
        setTargetBranch("");
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Reassignment error:', error);
      toast.error("Gagal melakukan reassignment: " + (error.message || 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReassign = async (email: string, branchName: string, riderName: string) => {
    setQuickActionLoading(email);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('reassign-rider-branch', {
        body: {
          rider_email: email,
          target_branch_name: branchName,
          set_role_to_sb_rider: true
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`${riderName} berhasil dipindahkan ke ${branchName}!`);
        setResult(data);
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Quick reassignment error:', error);
      toast.error(`Gagal memindahkan ${riderName}: ` + (error.message || 'Terjadi kesalahan'));
    } finally {
      setQuickActionLoading(null);
    }
  };

  // Only ho_admin can access this
  if (userProfile?.role !== 'ho_admin') {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Hanya HO Admin yang dapat mengakses halaman ini.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <UserCog className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Rider Reassignment</h1>
          <p className="text-muted-foreground">Pindahkan rider ke branch lain dengan aman</p>
        </div>
      </div>

      {/* Quick Actions for Z-009 and Z-011 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Quick Fix: Pindahkan Z-009 & Z-011
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Tombol di bawah akan langsung memindahkan rider yang salah branch ke small branch yang benar.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Z-009 Pak Alut</p>
                    <p className="text-sm text-muted-foreground">ZegerOTW09@gmail.com</p>
                    <p className="text-sm text-green-600 font-medium mt-1">→ Zeger Coffee Malang</p>
                  </div>
                  <Button 
                    onClick={() => handleQuickReassign(
                      "ZegerOTW09@gmail.com",
                      "Zeger Coffee Malang",
                      "Z-009 Pak Alut"
                    )}
                    disabled={quickActionLoading === "ZegerOTW09@gmail.com"}
                  >
                    {quickActionLoading === "ZegerOTW09@gmail.com" ? "Memproses..." : "Pindahkan"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Z-011 Pak Rikman</p>
                    <p className="text-sm text-muted-foreground">zegerotw01@gmail.com</p>
                    <p className="text-sm text-green-600 font-medium mt-1">→ Zeger Coffee Graha Kota</p>
                  </div>
                  <Button 
                    onClick={() => handleQuickReassign(
                      "zegerotw01@gmail.com",
                      "Zeger Coffee Graha Kota",
                      "Z-011 Pak Rikman"
                    )}
                    disabled={quickActionLoading === "zegerotw01@gmail.com"}
                  >
                    {quickActionLoading === "zegerotw01@gmail.com" ? "Memproses..." : "Pindahkan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Manual Reassignment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Reassignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              Form ini akan memindahkan rider ke branch baru dan memperbarui semua data terkait (inventory, shift management).
              Data historis transaksi lama tetap dipertahankan untuk audit trail.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rider-email">Email Rider</Label>
              <Input
                id="rider-email"
                type="email"
                value={riderEmail}
                onChange={(e) => setRiderEmail(e.target.value)}
                placeholder="rider@email.com"
              />
            </div>

            <div>
              <Label htmlFor="target-branch">Nama Target Branch</Label>
              <Input
                id="target-branch"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="Contoh: Zeger Coffee Malang"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nama branch harus sesuai dengan yang ada di database
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="set-sb-rider"
                checked={setSbRider}
                onCheckedChange={(checked) => setSetSbRider(checked as boolean)}
              />
              <Label htmlFor="set-sb-rider" className="text-sm">
                Ubah role menjadi sb_rider (Small Branch Rider)
              </Label>
            </div>
          </div>

          <Button onClick={handleReassign} disabled={loading} className="w-full">
            {loading ? "Memproses Reassignment..." : "Reassign Rider"}
          </Button>
        </CardContent>
      </Card>

      {/* Result Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">✓ Reassignment Berhasil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Pesan:</strong> {result.message}</p>
              {result.changes && (
                <div className="bg-muted p-4 rounded-lg space-y-1">
                  <p><strong>Detail Perubahan:</strong></p>
                  <p>• Profiles updated: {result.changes.profiles_updated}</p>
                  <p>• Inventory records updated: {result.changes.inventory_updated}</p>
                  <p>• Active shifts updated: {result.changes.shift_management_updated}</p>
                  {result.changes.role_changed && (
                    <p>• Role changed: {result.changes.role_changed}</p>
                  )}
                  <p>• Old branch ID: {result.changes.old_branch_id}</p>
                  <p>• New branch ID: {result.changes.new_branch_id}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
