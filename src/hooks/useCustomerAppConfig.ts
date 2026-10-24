import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeCategoryOrder } from '@/lib/customer-category-order';

export interface CustomerAppConfig {
  category_order: string[];
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
  order: {
    /** Ongkir untuk pesanan delivery dari outlet (Rupiah). */
    delivery_fee: number;
    /** Potongan ongkir dalam persen. */
    delivery_discount_percent: number;
    /** Biaya kemasan take away (Rupiah). */
    takeaway_charge: number;
    /** Jam buka/tutup store (WIB, HH:MM). */
    open_time: string;
    close_time: string;
  };
}

const DEFAULT: CustomerAppConfig = {
  category_order: [],
  features: { loyalty: true, subscription: true, vouchers: true, promo_reward: true, referral: true, care: true, notifications: true },
  sections: { membership: true, voucher_referral: true, order_types: true, rider_nearby: true, promo_active: true, big_order: true, zeger_care: true },
  care: { whatsapp_number: '628133180488', faq_items: [] },
  referral: { reward_points: 50, code_prefix: 'ZG-' },
  order: { delivery_fee: 25400, delivery_discount_percent: 20, takeaway_charge: 3500, open_time: '07:00', close_time: '22:00' },
};

let cache: CustomerAppConfig | null = null;
let cachePromise: Promise<CustomerAppConfig> | null = null;

async function loadConfig(): Promise<CustomerAppConfig> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    try {
      const [{ data }, { data: categoryOrder }] = await Promise.all([supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .eq('setting_type', 'customer_app')
        .eq('is_active', true), supabase.rpc('get_customer_category_order')]);
      const map: Record<string, any> = {};
      (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value; });
      const cfg: CustomerAppConfig = {
        category_order: normalizeCategoryOrder(categoryOrder),
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
        order: { ...DEFAULT.order, ...(map['order.fees'] || {}) },
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
  window.dispatchEvent(new Event('customer-app-config-changed'));
}

export function useCustomerAppConfig(): CustomerAppConfig {
  const [cfg, setCfg] = useState<CustomerAppConfig>(cache || DEFAULT);
  useEffect(() => {
    let alive = true;
    const refresh = () => { loadConfig().then(c => { if (alive) setCfg(c); }); };
    refresh();
    window.addEventListener('customer-app-config-changed', refresh);
    return () => { alive = false; window.removeEventListener('customer-app-config-changed', refresh); };
  }, []);
  return cfg;
}