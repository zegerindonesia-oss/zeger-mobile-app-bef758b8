// Google Maps API Configuration
// Key sources (in order):
// 1. Build-time env (Lovable-managed Google Maps Platform connector)
// 2. Runtime fallback via the `get-maps-key` edge function (works even when the
//    build did not receive the VITE_ env vars).
import { supabase } from '@/integrations/supabase/client';

const envKey =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ||
  (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ||
  '';

const envTrackingId =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined) ||
  (import.meta.env.VITE_GOOGLE_MAPS_TRACKING_ID as string | undefined) ||
  '';

let cachedKey = envKey;
let cachedTrackingId = envTrackingId;
let inFlight: Promise<string> | null = null;

/** Key already known synchronously (may be empty before the async loader runs). */
export const GOOGLE_MAPS_API_KEY = envKey;
export const GOOGLE_MAPS_TRACKING_ID = envTrackingId;
export const isGoogleMapsConfigured = Boolean(envKey);

export const getGoogleMapsKey = async (): Promise<string> => {
  if (cachedKey) return cachedKey;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-maps-key');
      if (error) throw error;
      if (data?.key) {
        cachedKey = data.key as string;
        cachedTrackingId = (data.trackingId as string) || cachedTrackingId;
      }
    } catch (e) {
      console.error('Gagal mengambil Google Maps browser key:', e);
    } finally {
      inFlight = null;
    }
    return cachedKey;
  })();

  return inFlight;
};

export const buildMapsScriptUrl = (extraParams: Record<string, string> = {}): string => {
  const params = new URLSearchParams({
    key: cachedKey,
    loading: 'async',
    ...(cachedTrackingId ? { channel: cachedTrackingId } : {}),
    ...extraParams,
  });
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
};
