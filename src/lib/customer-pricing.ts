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
  '1lt': 15000,
};

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
