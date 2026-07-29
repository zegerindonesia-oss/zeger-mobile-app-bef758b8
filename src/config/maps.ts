// Google Maps API Configuration
// Provisioned by the Lovable-managed Google Maps Platform connector.
// Restricted to *.lovable.app and *.lovableproject.com referrers.
export const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string) || '';

export const GOOGLE_MAPS_TRACKING_ID =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string) || '';

export const buildMapsScriptUrl = (extraParams: Record<string, string> = {}): string => {
  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
    loading: 'async',
    ...(GOOGLE_MAPS_TRACKING_ID ? { channel: GOOGLE_MAPS_TRACKING_ID } : {}),
    ...extraParams,
  });
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
};
