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
  // Login redirects reload the page, so remember when the splash started and continue it.
  const [remaining] = useState(() => {
    try {
      const forced = new URLSearchParams(window.location.search).has('splash');
      if (!Capacitor.isNativePlatform() && !forced) return 0;
      const started = Number(sessionStorage.getItem('native-splash-start') || 0);
      if (!started) {
        sessionStorage.setItem('native-splash-start', String(Date.now()));
        return 2700;
      }
      return Math.max(0, 2700 - (Date.now() - started));
    } catch { return 0; }
  });
  const show = remaining > 0;
  const [src] = useState(() => pickSplash(window.location.pathname));
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(!show);

  useEffect(() => {
    if (!show) return;
    import('@capacitor/splash-screen').then((m) => m.SplashScreen.hide()).catch(() => {});
    const a = setTimeout(() => setFading(true), Math.max(0, remaining - 500));
    const b = setTimeout(() => setGone(true), remaining);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [show, remaining]);

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
