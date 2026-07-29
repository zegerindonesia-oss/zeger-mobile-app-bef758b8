import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerAppConfig {
  features: {
    loyalty: boolean;
    subscription: boolean;
    vouchers: boolean;
    promo_reward: boolean;
    referral: boolean;
    care: boolean;
    notifications: boolean;
  };
  sections: {
    membership: boolean;
    voucher_referral: boolean;
    order_types: boolean;
    rider_nearby: boolean;
    promo_active: boolean;
    big_order: boolean;
    zeger_care: boolean;
  };
  care: {
    whatsapp_number: string;
    faq_items: { q: string; a: string }[];
  };
  referral: {
    reward_points: number;
    code_prefix: string;
  };
}

const DEFAULT: CustomerAppConfig = {
  features: { loyalty: true, subscription: true, vouchers: true, promo_reward: true, referral: true, care: true, notifications: true },
  sections: { membership: true, voucher_referral: true, order_types: true, rider_nearby: true, promo_active: true, big_order: true, zeger_care: true },
  care: { whatsapp_number: '6281330886182', faq_items: [] },
  referral: { reward_points: 50, code_prefix: 'ZG-' },
};

let cache: CustomerAppConfig | null = null;
let cachePromise: Promise<CustomerAppConfig> | null = null;

async function loadConfig(): Promise<CustomerAppConfig> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .eq('setting_type', 'customer_app')
        .eq('is_active', true);
      const map: Record<string, any> = {};
      (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value; });
      const cfg: CustomerAppConfig = {
        features: { ...DEFAULT.features, ...(map['customer_features'] || {}) },
        sections: { ...DEFAULT.sections, ...(map['customer_home.sections'] || {}) },
        care: {
          whatsapp_number: (typeof map['care.whatsapp_number'] === 'string' ? map['care.whatsapp_number'] : DEFAULT.care.whatsapp_number),
          faq_items: Array.isArray(map['care.faq_items']) ? map['care.faq_items'] : DEFAULT.care.faq_items,
        },
        referral: {
          reward_points: typeof map['referral.reward_points'] === 'number' ? map['referral.reward_points'] : DEFAULT.referral.reward_points,
          code_prefix: typeof map['referral.code_prefix'] === 'string' ? map['referral.code_prefix'] : DEFAULT.referral.code_prefix,
        },
      };
      cache = cfg;
      return cfg;
    } catch {
      return DEFAULT;
    } finally {
      cachePromise = null;
    }
  })();
  return cachePromise;
}

export function invalidateCustomerAppConfig() {
  cache = null;
}

export function useCustomerAppConfig(): CustomerAppConfig {
  const [cfg, setCfg] = useState<CustomerAppConfig>(cache || DEFAULT);
  useEffect(() => {
    let alive = true;
    loadConfig().then(c => { if (alive) setCfg(c); });
    return () => { alive = false; };
  }, []);
  return cfg;
}