/**
 * Shared price maths for the customer app so the menu bar, cart and checkout
 * can never disagree about what an order costs.
 */
export const TOPPING_PRICES: Record<string, number> = {
  espresso: 5000,
  oreo: 4000,
  cheese: 5000,
  jelly: 5000,
  icecream: 5000,
};

export const SIZE_UPCHARGE: Record<string, number> = {
  large: 5000,
  ultimate: 10000,
  '1lt': 15000,
};

export const TOPPING_LABELS: Record<string, string> = {
  espresso: 'Extra Espresso Shot',
  oreo: 'Oreo Crumb',
  cheese: 'Cheese Foam',
  jelly: 'Jelly Pearl',
  icecream: 'Ice Cream',
};

export const SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  regular: 'Regular',
  large: 'Large',
  ultimate: 'Ultimate',
  '200ml': '200 ml',
  '1lt': '1 Liter',
};

/** Human readable one-liner of everything the customer picked. */
export function describeCustomizations(c?: Record<string, any> | null): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.temperature) parts.push(c.temperature === 'hot' ? 'Panas' : 'Dingin');
  if (c.size) parts.push(SIZE_LABELS[c.size] || String(c.size));
  if (c.iceLevel) parts.push(`Es ${c.iceLevel === 'normal' ? 'Normal' : c.iceLevel === 'less' ? 'Sedikit' : 'Tanpa Es'}`);
  if (c.sugarLevel) parts.push(`Gula ${c.sugarLevel === 'normal' ? 'Normal' : c.sugarLevel === 'less' ? 'Sedikit' : 'Tanpa Gula'}`);
  if (Array.isArray(c.toppings) && c.toppings.length) {
    parts.push(c.toppings.map((t: string) => TOPPING_LABELS[t] || t).join(', '));
  }
  if (c.notes) parts.push(`"${c.notes}"`);
  return parts.join(' • ');
}

export interface PricedItem {
  price: number;
  quantity?: number;
  customizations?: { size?: string; toppings?: string[] } | null;
}

/** Price of a single unit including size upgrade and toppings. */
export function unitPrice(item: PricedItem): number {
  let price = Number(item.price) || 0;
  const size = item.customizations?.size;
  if (size && SIZE_UPCHARGE[size]) price += SIZE_UPCHARGE[size];
  const toppings = item.customizations?.toppings;
  if (Array.isArray(toppings)) {
    toppings.forEach((t) => { price += TOPPING_PRICES[t] || 0; });
  }
  return price;
}

export const lineTotal = (item: PricedItem) => unitPrice(item) * (item.quantity || 1);

export const cartSubtotal = (cart: PricedItem[]) =>
  (cart || []).reduce((sum, item) => sum + lineTotal(item), 0);

export const cartItemCount = (cart: PricedItem[]) =>
  (cart || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

/** Zeger loyalty: 1 point for every Rp10.000 spent. */
export const pointsFor = (amount: number) => Math.floor((amount || 0) / 10000);
