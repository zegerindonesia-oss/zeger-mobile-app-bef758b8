import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import posSplash from '@/assets/splash/pos.jpg';
import riderSplash from '@/assets/splash/rider.jpg';
import customerSplash from '@/assets/splash/customer.jpg';

/** Full-screen launch splash for the native shells (POS / Rider / Customer), once per app launch. */
const pickSplash = (path: string) => {
  if (path.startsWith('/mobile-seller') || path.startsWith('/rider')) return riderSplash;
  if (path.startsWith('/customer')) return customerSplash;
  return posSplash;
};

export const NativeSplash = () => {
  const [show] = useState(() => {
    try {
      const forced = new URLSearchParams(window.location.search).has('splash');
      if (!Capacitor.isNativePlatform() && !forced) return false;
      if (sessionStorage.getItem('native-splash-shown')) return false;
      sessionStorage.setItem('native-splash-shown', '1');
      return true;
    } catch { return false; }
  });
  const [src] = useState(() => pickSplash(window.location.pathname));
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(!show);

  useEffect(() => {
    if (!show) return;
    import('@capacitor/splash-screen').then((m) => m.SplashScreen.hide()).catch(() => {});
    const a = setTimeout(() => setFading(true), 2200);
    const b = setTimeout(() => setGone(true), 2700);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [show]);

  if (gone) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] bg-background transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
      aria-hidden
    >
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
};
