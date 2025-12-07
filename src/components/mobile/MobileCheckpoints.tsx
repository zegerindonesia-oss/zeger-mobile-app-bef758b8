import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MapPin, 
  Plus, 
  Navigation,
  Clock,
  Target,
  CheckCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Checkpoint {
  id: string;
  checkpoint_name: string;
  latitude: number;
  longitude: number;
  address_info: string;
  created_at: string;
  notes?: string;
}

const MobileCheckpoints = () => {
  const { userProfile } = useAuth();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [newCheckpoint, setNewCheckpoint] = useState({
    name: "",
    notes: ""
  });

  useEffect(() => {
    fetchCheckpoints();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ lat: latitude, lng: longitude });
        },
        (error) => {
          toast.error("Gagal mendapatkan lokasi: " + error.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    }
  };

  const fetchCheckpoints = async () => {
    try {
      if (!userProfile?.id) return;

      // Use Jakarta timezone for date filtering
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const { data } = await supabase
        .from('checkpoints')
        .select('*')
        .eq('rider_id', userProfile.id)
        .gte('created_at', `${today}T00:00:00+07:00`)
        .lte('created_at', `${today}T23:59:59+07:00`)
        .order('created_at', { ascending: false });

      setCheckpoints(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data checkpoint");
    }
  };

  const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    try {
      // Using a simple reverse geocoding approach
      // In production, you'd use a proper geocoding service
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const addCheckpoint = async () => {
    if (!location) {
      toast.error("Lokasi belum tersedia");
      return;
    }

    if (!newCheckpoint.name.trim()) {
      toast.error("Nama checkpoint harus diisi");
      return;
    }

    setLoading(true);
    try {
      const address = await getAddressFromCoords(location.lat, location.lng);
      
      const { error } = await supabase
        .from('checkpoints')
        .insert([{
          rider_id: userProfile?.id,
          branch_id: userProfile?.branch_id,
          checkpoint_name: newCheckpoint.name,
          latitude: location.lat,
          longitude: location.lng,
          address_info: address,
          notes: newCheckpoint.notes
        }]);

      if (error) throw error;

      toast.success("Checkpoint berhasil ditambahkan!");
      setNewCheckpoint({ name: "", notes: "" });
      setShowAddForm(false);
      fetchCheckpoints();
    } catch (error: any) {
      toast.error("Gagal menambahkan checkpoint: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Check Points Hari Ini
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-green-500 hover:bg-green-600"
              >
                <Plus className="h-4 w-4 mr-1" />
                Tambah
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <span>Total checkpoint hari ini:</span>
              <Badge variant="secondary">{checkpoints.length}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Add Checkpoint Form */}
        {showAddForm && (
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-green-800">Tambah Checkpoint Baru</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nama Lokasi</label>
                <Input
                  placeholder="Contoh: Taman Kota, Mall ABC, etc"
                  value={newCheckpoint.name}
                  onChange={(e) => setNewCheckpoint(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Catatan (Opsional)</label>
                <Textarea
                  placeholder="Deskripsi lokasi atau catatan lainnya..."
                  value={newCheckpoint.notes}
                  onChange={(e) => setNewCheckpoint(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              {location && (
                <div className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Koordinat Saat Ini:</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={addCheckpoint}
                  disabled={loading || !location}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                >
                  {loading ? "Menyimpan..." : "Simpan Checkpoint"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="px-6"
                >
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Checkpoints List */}
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Checkpoint</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {checkpoints.map((checkpoint, index) => (
                  <div key={checkpoint.id} className="p-4 border rounded-lg bg-white shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-medium">{checkpoint.checkpoint_name}</h4>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTime(checkpoint.created_at)}
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Aktif
                      </Badge>
                    </div>

                    <div className="text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1 mb-1">
                        <MapPin className="h-3 w-3" />
                        {checkpoint.address_info}
                      </div>
                      {checkpoint.notes && (
                        <p className="text-xs bg-muted p-2 rounded mt-2">
                          {checkpoint.notes}
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openInMaps(checkpoint.latitude, checkpoint.longitude)}
                      className="w-full"
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      Lihat di Maps
                    </Button>
                  </div>
                ))}

                {checkpoints.length === 0 && (
                  <div className="text-center py-8">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Belum ada checkpoint hari ini</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tambah checkpoint untuk melacak lokasi penjualan
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobileCheckpoints;