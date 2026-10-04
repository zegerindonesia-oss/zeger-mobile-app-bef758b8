// F&B modifier system. Products can override via products.custom_options:
// { "modifier_groups": [{ "name": "Suhu", "required": true, "multi": false, "options": [{ "name": "Ice", "price": 0 }] }] }
export interface ModifierOption { name: string; price: number }
export interface ModifierGroup {
  name: string;
  required: boolean;
  multi: boolean;
  options: ModifierOption[];
  default?: string;
}

export const DEFAULT_DRINK_MODIFIERS: ModifierGroup[] = [
  { name: 'Suhu', required: true, multi: false, default: 'Ice',
    options: [{ name: 'Ice', price: 0 }, { name: 'Hot', price: 0 }] },
  { name: 'Gula', required: true, multi: false, default: 'Normal Sugar',
    options: [{ name: 'Normal Sugar', price: 0 }, { name: 'Less Sugar', price: 0 }, { name: 'No Sugar', price: 0 }] },
  { name: 'Es', required: false, multi: false,
    options: [{ name: 'Less Ice', price: 0 }, { name: 'Extra Ice', price: 0 }] },
  { name: 'Susu', required: false, multi: false,
    options: [{ name: 'Oat Milk', price: 6000 }, { name: 'Almond Milk', price: 6000 }] },
  { name: 'Add-on', required: false, multi: true,
    options: [{ name: 'Extra Shot', price: 4000 }, { name: 'Extra Aren', price: 3000 }, { name: 'Boba', price: 4000 }] },
];

const FOOD_HINTS = ['food', 'makan', 'snack', 'pastry', 'roti', 'bread', 'cake', 'kue', 'merch', 'bundle', 'custom'];

export const getModifierGroups = (product: { category?: string | null; custom_options?: any }): ModifierGroup[] => {
  const co = product.custom_options;
  if (co && Array.isArray(co.modifier_groups)) return co.modifier_groups as ModifierGroup[];
  const cat = (product.category || '').toLowerCase();
  if (FOOD_HINTS.some((h) => cat.includes(h))) return [];
  return DEFAULT_DRINK_MODIFIERS;
};

export const allModifierNames = (groups: ModifierGroup[] = DEFAULT_DRINK_MODIFIERS) =>
  groups.flatMap((g) => g.options.map((o) => o.name));

export const modifierPrice = (groups: ModifierGroup[], selected: string[]) =>
  groups.flatMap((g) => g.options).filter((o) => selected.includes(o.name)).reduce((s, o) => s + o.price, 0);

export const defaultSelection = (groups: ModifierGroup[]) =>
  groups.filter((g) => g.default).map((g) => g.default!) ;

/** Fill missing required groups with defaults; keep only one option per single-select group. */
export const normalizeSelection = (groups: ModifierGroup[], picked: string[]) => {
  const result: string[] = [];
  for (const g of groups) {
    const names = g.options.map((o) => o.name.toLowerCase());
    const hits = picked.filter((p) => names.includes(p.toLowerCase()))
      .map((p) => g.options.find((o) => o.name.toLowerCase() === p.toLowerCase())!.name);
    if (g.multi) result.push(...hits);
    else if (hits.length) result.push(hits[hits.length - 1]);
    else if (g.required && g.default) result.push(g.default);
  }
  return result;
};
