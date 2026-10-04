import { useState, useCallback, useMemo } from 'react';

export interface POSCartItem {
  product_id: string;
  product_code: string;
  product_name: string;
  category: string | null;
  price: number;
  qty: number;
  discount_item: number;
  notes: string;
  image_url?: string | null;
  is_custom?: boolean;
  bundle_id?: string;
  bundle_name?: string;
  /** Unique cart line key (product + modifiers + notes). */
  line_id: string;
  modifiers?: string[];
}

export interface AddItemOptions { qty?: number; modifiers?: string[]; notes?: string; extraPrice?: number }

const lineKey = (pid: string, mods: string[] = [], notes = '') =>
  `${pid}::${[...mods].sort().join('|')}::${notes.trim().toLowerCase()}`;

export const usePOSCart = () => {
  const [items, setItems] = useState<POSCartItem[]>([]);
  const [discountBill, setDiscountBill] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [serviceChargePercent, setServiceChargePercent] = useState(0);

  const addItem = useCallback(
    (product: Omit<POSCartItem, 'qty' | 'discount_item' | 'notes' | 'line_id' | 'modifiers'>, opts: AddItemOptions = {}) => {
      const qty = Math.max(1, opts.qty ?? 1);
      const mods = opts.modifiers ?? [];
      const notes = opts.notes ?? '';
      const key = lineKey(product.product_id, mods, notes);
      setItems((prev) => {
        const existing = prev.find((i) => i.line_id === key && !i.bundle_id && !i.is_custom);
        if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + qty } : i));
        return [...prev, {
          ...product,
          price: product.price + (opts.extraPrice ?? 0),
          qty, discount_item: 0, notes, modifiers: mods, line_id: key,
        }];
      });
    }, []);

  const addCustomItem = useCallback(
    (data: { name: string; price: number; qty: number; notes: string }) => {
      const id = `custom-${Date.now()}`;
      setItems((prev) => [
        ...prev,
        {
          product_id: id,
          product_code: 'CUSTOM',
          product_name: data.name,
          category: 'Custom',
          price: data.price,
          qty: data.qty,
          discount_item: 0,
          notes: data.notes,
          is_custom: true,
          line_id: id,
        },
      ]);
    },
    []
  );

  const addBundle = useCallback(
    (bundle: {
      id: string;
      name: string;
      price: number;
      components: Array<{ product_id: string; qty: number; product_name?: string }>;
    }) => {
      const bundleKey = `${bundle.id}-${Date.now()}`;
      const newItems: POSCartItem[] = bundle.components.map((c, idx) => {
        const componentPrice =
          idx === 0
            ? bundle.price -
              bundle.components.slice(1).reduce((s) => s, 0) // first item carries the bundle price
            : 0;
        return {
          product_id: c.product_id,
          product_code: 'BUNDLE',
          product_name: `${c.product_name || 'Item'} (${bundle.name})`,
          category: 'Bundle',
          price: idx === 0 ? bundle.price : 0,
          qty: c.qty,
          discount_item: 0,
          notes: '',
          bundle_id: bundleKey,
          bundle_name: bundle.name,
          line_id: `${bundleKey}::${idx}`,
        };
      });
      setItems((prev) => [...prev, ...newItems]);
    },
    []
  );

  // All line operations are keyed by line_id
  const updateQty = useCallback((line_id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.line_id !== line_id)
        : prev.map((i) => (i.line_id === line_id ? { ...i, qty } : i))
    );
  }, []);

  const updateNotes = useCallback((line_id: string, notes: string) => {
    setItems((prev) => prev.map((i) => (i.line_id === line_id ? { ...i, notes } : i)));
  }, []);

  const setItemDiscount = useCallback((line_id: string, discountPerUnit: number) => {
    setItems((prev) =>
      prev.map((i) => (i.line_id === line_id ? { ...i, discount_item: discountPerUnit } : i))
    );
  }, []);

  const removeItem = useCallback((line_id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.line_id === line_id);
      if (target?.bundle_id) return prev.filter((i) => i.bundle_id !== target.bundle_id);
      return prev.filter((i) => i.line_id !== line_id);
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setDiscountBill(0);
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const discountItem = items.reduce((s, i) => s + i.discount_item * i.qty, 0);
    const afterDiscount = Math.max(0, subtotal - discountItem - discountBill);
    const serviceCharge = (afterDiscount * serviceChargePercent) / 100;
    const tax = ((afterDiscount + serviceCharge) * taxPercent) / 100;
    const total = afterDiscount + serviceCharge + tax;
    return {
      subtotal,
      discountItem,
      discountBill,
      serviceCharge,
      tax,
      total: Math.max(0, total),
      itemCount: items.reduce((s, i) => s + i.qty, 0),
    };
  }, [items, discountBill, taxPercent, serviceChargePercent]);

  return {
    items,
    addItem,
    addCustomItem,
    addBundle,
    updateQty,
    updateNotes,
    setItemDiscount,
    removeItem,
    clear,
    discountBill,
    setDiscountBill,
    taxPercent,
    setTaxPercent,
    serviceChargePercent,
    setServiceChargePercent,
    totals,
  };
};
