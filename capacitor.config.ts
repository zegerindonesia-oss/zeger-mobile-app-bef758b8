import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Three native apps from one codebase. Select with APP_TARGET=pos|rider|customer.
 * Each app is a shell that loads the published domain at its own start page,
 * so content updates go live without rebuilding the APK/IPA.
 */
const DOMAIN = 'https://erp.zegercoffee.com';

const targets = {
  pos: { appId: 'com.flowfnb.pos', appName: 'Flow F&B POS', path: '/pos', dir: 'native/pos' },
  rider: { appId: 'com.zeger.rider', appName: 'Zeger Rider', path: '/mobile-seller', dir: 'native/rider' },
  customer: { appId: 'com.zeger.customer', appName: 'Zeger', path: '/customer-app', dir: 'native/customer' },
} as const;

const key = (process.env.APP_TARGET || 'pos') as keyof typeof targets;
const t = targets[key] ?? targets.pos;

const config: CapacitorConfig = {
  appId: t.appId,
  appName: t.appName,
  webDir: 'dist',
  server: { url: `${DOMAIN}${t.path}`, cleartext: true },
  android: { path: `${t.dir}/android`, allowMixedContent: true },
  ios: { path: `${t.dir}/ios` },
};

export default config;
