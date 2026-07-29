import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const googleMapsBrowserKey =
  process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ||
  process.env.GOOGLE_MAPS_BROWSER_KEY ||
  '';

const googleMapsTrackingId =
  process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID ||
  process.env.GOOGLE_MAPS_TRACKING_ID ||
  '';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
  define: {
    'import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY': JSON.stringify(googleMapsBrowserKey),
    'import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID': JSON.stringify(googleMapsTrackingId),
  },
}));
