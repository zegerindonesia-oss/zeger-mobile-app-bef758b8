/** Per order-mode price uprise (channel pricing), configured per branch in Back Office. */
export type PricingModel = 'none' | 'percent' | 'fixed' | 'gross_up';
export type RoundingRule = 'exact' | '500' | '1000';

export interface ModePricingRule { model: PricingModel; value: number; rounding: RoundingRule }
export type ModePricingMap = Record<string, ModePricingRule>;

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  none: 'Harga offline (tanpa kenaikan)',
  percent: 'Markup persentase (+%)',
  fixed: 'Nominal tetap (+Rp)',
  gross_up: 'Net Recovery / Gross-up (komisi %)',
};

const roundUp = (n: number, r: RoundingRule) => (r === 'exact' ? Math.round(n) : Math.ceil(n / Number(r)) * Number(r));

/** Applies the mode rule to an offline price. gross_up = price / (1 - commission%), so net after commission equals offline. */
export const applyModePrice = (price: number, rule?: ModePricingRule | null): number => {
  if (!rule || rule.model === 'none' || !price) return price;
  const v = Number(rule.value) || 0;
  let out = price;
  if (rule.model === 'percent') out = price * (1 + v / 100);
  else if (rule.model === 'fixed') out = price + v;
  else if (rule.model === 'gross_up') out = v > 0 && v < 100 ? price / (1 - v / 100) : price;
  return roundUp(out, rule.rounding || 'exact');
};

export const ruleSummary = (rule?: ModePricingRule | null) => {
  if (!rule || rule.model === 'none') return '';
  if (rule.model === 'fixed') return `+Rp${Number(rule.value).toLocaleString('id-ID')}`;
  if (rule.model === 'percent') return `+${rule.value}%`;
  return `Net Recovery ${rule.value}%`;
};
