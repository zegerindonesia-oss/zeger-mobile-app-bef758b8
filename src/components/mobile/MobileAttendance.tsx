import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  MapPin, 
  Clock, 
  CheckCircle,
  AlertCircle,
  LogIn,
  LogOut,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AttendanceRecord {
  id: string;
  status: string;
  check_in_time?: string;
  check_out_time?: string;
  check_in_location?: string;
  check_out_location?: string;
  check_in_photo_url?: string;
  check_out_photo_url?: string;
  work_date: string;
}

const MobileAttendance = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Temporarily disable photo requirement for attendance due to device issues
  const REQUIRE_PHOTO = false;
  
  useEffect(() => {
    fetchTodayAttendance();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ lat: latitude, lng: longitude });
          
          // Get location name using reverse geocoding
          try {
            const response = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=YOUR_API_KEY&limit=1`
            );
            const data = await response.json();
            if (data.results && data.results[0]) {
              setLocationName(data.results[0].formatted);
            } else {
              setLocationName(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            }
          } catch (error) {
            setLocationName(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }
        },
        (error) => {
          toast.error("Gagal mendapatkan lokasi: " + error.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } else {
      toast.error("Geolocation tidak didukung pada browser ini");
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      if (!userProfile?.id) return;

      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('rider_id', userProfile.id)
        .eq('work_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setTodayAttendance(data);
    } catch (error: any) {
      console.error("Error fetching attendance:", error);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        setCameraActive(true);
        await new Promise<void>((resolve) => {
          const onReady = () => resolve();
          video.addEventListener('loadedmetadata', onReady, { once: true });
          video.addEventListener('canplay', onReady, { once: true });
        });
        await video.play();
      }
    } catch (error: any) {
      toast.error("Gagal mengakses kamera: " + error.message);
    }
  };

  const waitForVideoReady = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
    await new Promise<void>((resolve) => {
      const onReady = () => resolve();
      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
    });
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const uploadPhoto = async (photoDataUrl: string, type: 'check_in' | 'check_out'): Promise<string> => {
    const base64Data = photoDataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    const fileName = `${userProfile?.user_id}/${type}-${Date.now()}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('attendance-photos')
      .upload(fileName, blob);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('attendance-photos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleCheckIn = async () => {
    if (!location) {
      toast.error("Lokasi belum tersedia");
      return;
    }

    setLoading(true);
    try {
      let photoUrl: string | undefined;
      if (REQUIRE_PHOTO) {
        await startCamera();
        await waitForVideoReady();
        await new Promise((r) => setTimeout(r, 500));
        const photoDataUrl = capturePhoto();
        if (!photoDataUrl) {
          throw new Error("Gagal mengambil foto");
        }
        stopCamera();
        photoUrl = await uploadPhoto(photoDataUrl, 'check_in');
      }

      // Create attendance record
      const { error } = await supabase
        .from('attendance')
        .insert([{
          rider_id: userProfile?.id,
          branch_id: userProfile?.branch_id,
          status: 'checked_in',
          check_in_time: new Date().toISOString(),
          check_in_location: locationName || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
          check_in_photo_url: photoUrl || null,
          work_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
        }]);

      if (error) throw error;

      toast.success("Berhasil check-in!");
      fetchTodayAttendance();
    } catch (error: any) {
      toast.error("Gagal check-in: " + error.message);
    } finally {
      setLoading(false);
      stopCamera();
    }
  };

  const handleCheckOut = async () => {
    if (!location) {
      toast.error("Lokasi belum tersedia");
      return;
    }

    if (!todayAttendance) {
      toast.error("Anda belum check-in hari ini");
      return;
    }

    setLoading(true);
    try {
      let photoUrl: string | undefined;
      if (REQUIRE_PHOTO) {
        await startCamera();
        await waitForVideoReady();
        await new Promise((r) => setTimeout(r, 500));
        const photoDataUrl = capturePhoto();
        if (!photoDataUrl) {
          throw new Error("Gagal mengambil foto");
        }
        stopCamera();
        photoUrl = await uploadPhoto(photoDataUrl, 'check_out');
      }

      // Update attendance record
      const { error } = await supabase
        .from('attendance')
        .update({
          status: 'checked_out',
          check_out_time: new Date().toISOString(),
          check_out_location: locationName || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
          check_out_photo_url: photoUrl || null
        })
        .eq('id', todayAttendance.id);

      if (error) throw error;

      toast.success("Berhasil check-out!");
      fetchTodayAttendance();
    } catch (error: any) {
      toast.error("Gagal check-out: " + error.message);
    } finally {
      setLoading(false);
      stopCamera();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50/30 to-white p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Absensi Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <p className="text-2xl font-bold">
                {new Date().toLocaleDateString('id-ID', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-lg text-muted-foreground">
                {new Date().toLocaleTimeString('id-ID', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </p>
            </div>

            {/* Location Info */}
            {location && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
                <MapPin className="h-4 w-4 text-primary" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">Lokasi Saat Ini:</p>
                  <p className="text-muted-foreground">{locationName}</p>
                </div>
              </div>
            )}

            {/* Attendance Status */}
            {todayAttendance ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Check-in</p>
                      <p className="text-sm text-green-600">
                        {todayAttendance.check_in_time && 
                          new Date(todayAttendance.check_in_time).toLocaleTimeString('id-ID')
                        }
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Selesai</Badge>
                </div>

                {todayAttendance.status === 'checked_out' ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <LogOut className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-blue-800">Check-out</p>
                        <p className="text-sm text-blue-600">
                          {todayAttendance.check_out_time && 
                            new Date(todayAttendance.check_out_time).toLocaleTimeString('id-ID')
                          }
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">Selesai</Badge>
                  </div>
                ) : (
                  <Button
                    onClick={handleCheckOut}
                    disabled={loading || !location}
                    className="w-full h-14 bg-red-500 hover:bg-red-600 text-white"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <LogOut className="h-5 w-5 mr-2" />
                    )}
                    Check-out
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleCheckIn}
                disabled={loading || !location}
                className="w-full h-14 bg-green-500 hover:bg-green-600 text-white"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <LogIn className="h-5 w-5 mr-2" />
                )}
                Check-in
              </Button>
            )}

            {!location && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200 mt-4">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <p className="text-sm text-orange-700">
                  Menunggu lokasi GPS...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Camera View */}
        {cameraActive && (
          <Card className="fixed inset-0 z-40 bg-black">
            <CardContent className="p-0 h-full relative">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <Button
                onClick={stopCamera}
                variant="outline"
                className="absolute top-4 right-4 bg-white/80"
              >
                Tutup
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default MobileAttendance;