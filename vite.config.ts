import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const googleMapsBrowserKey =
    env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ||
    env.VITE_GOOGLE_MAPS_BROWSER_KEY ||
    env.GOOGLE_MAPS_BROWSER_KEY ||
    '';

  const googleMapsTrackingId =
    env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID ||
    env.VITE_GOOGLE_MAPS_TRACKING_ID ||
    env.GOOGLE_MAPS_TRACKING_ID ||
    '';

  // Only override when we actually resolved a value, so we never blank out
  // the value Vite already injects from .env.
  const define: Record<string, string> = {};
  if (googleMapsBrowserKey) {
    define['import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'] =
      JSON.stringify(googleMapsBrowserKey);
    define['import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY'] = JSON.stringify(googleMapsBrowserKey);
  }
  if (googleMapsTrackingId) {
    define['import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'] =
      JSON.stringify(googleMapsTrackingId);
    define['import.meta.env.VITE_GOOGLE_MAPS_TRACKING_ID'] = JSON.stringify(googleMapsTrackingId);
  }

  return {
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define,
  };
});
