// Menu Engineering (Kasavana & Smith) + recipe costing helpers.
export type MenuClass = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export interface RecipeLine { material_id: string; quantity: number }
export interface MaterialCost { id: string; cost_per_unit: number }

/** Plate cost per portion incl. wastage buffer (%). Uses latest purchase price stored on the material. */
export function recipeCost(lines: RecipeLine[], mats: Record<string, MaterialCost>, wastagePct = 0, priceOverride: Record<string, number> = {}) {
  const base = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(priceOverride[l.material_id] ?? mats[l.material_id]?.cost_per_unit ?? 0), 0);
  return base * (1 + (wastagePct || 0) / 100);
}

/** Selling price needed to hit a target food cost %. */
export function priceForTarget(cost: number, targetPct: number) {
  if (!targetPct || targetPct <= 0) return 0;
  return cost / (targetPct / 100);
}

export interface MenuRow { id: string; name: string; qty: number; price: number; cost: number }
export interface MenuResult extends MenuRow { cm: number; totalCm: number; revenue: number; mixPct: number; foodCostPct: number; cls: MenuClass }

/**
 * Kasavana & Smith: popularity is high when menu mix >= 70% of an equal share (1/n);
 * profitability is high when item contribution margin >= weighted-average CM.
 */
export function classifyMenu(rows: MenuRow[]) {
  const sold = rows.filter((r) => r.qty > 0);
  const n = sold.length;
  const totalQty = sold.reduce((s, r) => s + r.qty, 0);
  const totalCm = sold.reduce((s, r) => s + r.qty * (r.price - r.cost), 0);
  const popThreshold = n ? (1 / n) * 0.7 * 100 : 0;
  const avgCm = totalQty ? totalCm / totalQty : 0;
  const items: MenuResult[] = sold.map((r) => {
    const cm = r.price - r.cost;
    const mixPct = totalQty ? (r.qty / totalQty) * 100 : 0;
    const hiPop = mixPct >= popThreshold;
    const hiCm = cm >= avgCm;
    const cls: MenuClass = hiPop && hiCm ? 'star' : hiPop ? 'plowhorse' : hiCm ? 'puzzle' : 'dog';
    return { ...r, cm, totalCm: cm * r.qty, revenue: r.price * r.qty, mixPct, foodCostPct: r.price ? (r.cost / r.price) * 100 : 0, cls };
  });
  return { items, popThreshold, avgCm, totalQty, totalCm };
}
