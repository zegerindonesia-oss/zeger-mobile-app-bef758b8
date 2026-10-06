import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const ALL_MODULES = ['pos', 'table', 'kds', 'queue', 'bom', 'loyalty', 'rider', 'customer_app', 'voice', 'invoice', 'finance'];

let cache: { uid: string; modules: string[] } | null = null;

/**
 * Active SaaS modules for the signed-in user's tenant.
 * Falls back to all modules (Zeger pilot behaviour) when the tenant row is unreadable.
 */
export const useTenantModules = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState<string[]>(cache && cache.uid === user?.id ? cache.modules : ALL_MODULES);

  useEffect(() => {
    if (!user) return;
    if (cache?.uid === user.id) { setModules(cache.modules); return; }
    let alive = true;
    (async () => {
      const { data: tid } = await (supabase.rpc as any)('current_tenant_id');
      if (!tid) return;
      // Freemium fallback: expired trials drop to Free on the server.
      await (supabase.rpc as any)('downgrade_expired_trials').catch?.(() => {});
      const { data } = await (supabase.from as any)('tenants').select('modules, subscription_status, trial_ends_at').eq('id', tid).maybeSingle();
      const trialOver = data?.subscription_status === 'trial' && data?.trial_ends_at && new Date(data.trial_ends_at).getTime() < Date.now();
      const mods: string[] = trialOver ? ['pos'] : data?.modules?.length ? data.modules : ALL_MODULES;
      cache = { uid: user.id, modules: mods };
      if (alive) setModules(mods);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const hasModule = (m?: string) => !m || modules.includes(m);
  return { modules, hasModule };
};
