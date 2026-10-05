import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FlowLogo } from '@/components/flow/FlowLogo';
import { TRIAL_DAYS } from './FlowSignup';

/** Google OAuth landing: wait for the session, start the trial for new tenants, then route to onboarding/workspace. */
const FlowAuthCallback = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const oauthErr = params.get('error_description') || new URLSearchParams(window.location.hash.slice(1)).get('error_description');
    if (oauthErr) { setError(oauthErr); return; }

    const finish = async () => {
      if (done) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      done = true;
      const meta = (session.user.user_metadata || {}) as Record<string, any>;
      if (!meta.flow_tenant && !meta.role) {
        await supabase.auth.updateUser({
          data: {
            flow_tenant: true,
            flow_plan: params.get('plan') || meta.flow_plan || 'pro',
            trial_ends_at: meta.trial_ends_at || new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
            onboarded: false,
            full_name: meta.full_name || meta.name || '',
          },
        });
        nav('/onboarding', { replace: true });
        return;
      }
      if (meta.flow_tenant) nav(meta.onboarded ? '/' : '/onboarding', { replace: true });
      else nav('/', { replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) setTimeout(finish, 0); });
    finish();
    const t = setTimeout(() => { if (!done) setError('Sesi login tidak ditemukan. Silakan coba lagi.'); }, 10000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, [nav, params]);

  return (
    <div className="flow-site min-h-screen grid place-items-center px-5 flow-hero-glow">
      <div className="flow-card rounded-[32px] p-10 max-w-md text-center">
        <div className="flex justify-center"><FlowLogo size="sm" /></div>
        {error ? (
          <>
            <h1 className="mt-6 text-2xl font-extrabold flow-ink">Login Google gagal</h1>
            <p className="mt-3 flow-muted">{error}</p>
            <Link to="/daftar" className="flow-btn mt-8 inline-flex rounded-2xl px-6 py-3.5 font-bold">Kembali ke Daftar</Link>
          </>
        ) : (
          <>
            <div className="mx-auto mt-6 h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
            <p className="mt-4 flow-muted">Menyiapkan akun Anda…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default FlowAuthCallback;
