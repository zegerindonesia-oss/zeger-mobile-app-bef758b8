import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.da79e49a94fe467d97d76ca216bcdfe8',
  appName: 'Flow F&B',
  webDir: 'dist',
  server: {
    // Live app: APK always shows the latest published version.
    url: 'https://erp.zegercoffee.com',
    cleartext: true,
  },
  android: { allowMixedContent: true },
};

export default config;
