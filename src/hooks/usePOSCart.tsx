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
}

export const usePOSCart = () => {
  const [items, setItems] = useState<POSCartItem[]>([]);
  const [discountBill, setDiscountBill] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [serviceChargePercent, setServiceChargePercent] = useState(0);

  const addItem = useCallback((product: Omit<POSCartItem, 'qty' | 'discount_item' | 'notes'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.product_id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.product_id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { ...product, qty: 1, discount_item: 0, notes: '' }];
    });
  }, []);

  const updateQty = useCallback((product_id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product_id !== product_id)
        : prev.map((i) => (i.product_id === product_id ? { ...i, qty } : i))
    );
  }, []);

  const updateNotes = useCallback((product_id: string, notes: string) => {
    setItems((prev) => prev.map((i) => (i.product_id === product_id ? { ...i, notes } : i)));
  }, []);

  const removeItem = useCallback((product_id: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== product_id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setDiscountBill(0);
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const discountItem = items.reduce((s, i) => s + i.discount_item * i.qty, 0);
    const afterDiscount = subtotal - discountItem - discountBill;
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
    updateQty,
    updateNotes,
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
