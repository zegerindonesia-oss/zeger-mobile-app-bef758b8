import { supabase } from "@/integrations/supabase/client";

// Utility functions for consistent financial calculations across all reports

export const formatDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizePaymentMethod = (paymentMethod: string): string => {
  const method = (paymentMethod || '').toLowerCase();
  if (method === 'bank_transfer' || method === 'bank') return 'transfer';
  return method;
};

export interface RevenueBreakdown {
  cash: number;
  qris: number;
  transfer: number;
  mdr: number;
}

export interface ExpenseBreakdown {
  rawMaterial: number;
  operationalDaily: number;
  salary: number;
  rent: number;
  household: number;
  environment: number;
  other: number;
  marketing: number;
  administration: number;
  depreciation: number;
  interest: number;
  tax: number;
}

export const calculateRevenue = async (
  startDate: Date,
  endDate: Date,
  selectedRider?: string
): Promise<RevenueBreakdown> => {
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  let transQuery = supabase
    .from('transactions')
    .select('id, final_amount, payment_method, rider_id, status, transaction_date')
    .eq('status', 'completed')
    .gte('transaction_date', `${startStr}T00:00:00`)
    .lte('transaction_date', `${endStr}T23:59:59`);

  if (selectedRider && selectedRider !== "all") {
    transQuery = transQuery.eq('rider_id', selectedRider);
  }

  const { data: transactions } = await transQuery;

  let cashRevenue = 0;
  let qrisRevenue = 0;
  let transferRevenue = 0;
  let mdrAmount = 0;

  (transactions || []).forEach((trans: any) => {
    const amount = Number(trans.final_amount || 0);
    const paymentMethod = normalizePaymentMethod(trans.payment_method);
    
    if (paymentMethod === 'cash') {
      cashRevenue += amount;
    } else if (paymentMethod === 'qris') {
      qrisRevenue += amount;
      mdrAmount += amount * 0.007; // 0.7% MDR
    } else if (paymentMethod === 'transfer') {
      transferRevenue += amount;
    }
  });

  return {
    cash: cashRevenue,
    qris: qrisRevenue,
    transfer: transferRevenue,
    mdr: mdrAmount
  };
};

export const calculateRawMaterialCost = async (
  startDate: Date,
  endDate: Date,
  selectedRider?: string
): Promise<number> => {
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  let transQuery = supabase
    .from('transactions')
    .select('id, rider_id')
    .eq('status', 'completed')
    .gte('transaction_date', `${startStr}T00:00:00`)
    .lte('transaction_date', `${endStr}T23:59:59`);

  if (selectedRider && selectedRider !== "all") {
    transQuery = transQuery.eq('rider_id', selectedRider);
  }

  const { data: transactions } = await transQuery;
  const transactionIds = transactions?.map(t => t.id) || [];

  if (transactionIds.length === 0) return 0;

  const { data: items } = await supabase
    .from('transaction_items')
    .select('quantity, products!inner(cost_price)')
    .in('transaction_id', transactionIds);

  return items?.reduce((sum, item: any) => 
    sum + (item.quantity || 0) * (Number(item.products?.cost_price) || 0), 0
  ) || 0;
};

export const calculateOperationalExpenses = async (
  startDate: Date,
  endDate: Date,
  selectedRider?: string
): Promise<ExpenseBreakdown> => {
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  let expenseQuery = supabase
    .from('daily_operational_expenses')
    .select('amount, expense_type, rider_id')
    .gte('expense_date', startStr)
    .lte('expense_date', endStr);

  if (selectedRider && selectedRider !== "all") {
    expenseQuery = expenseQuery.eq('rider_id', selectedRider);
  }

  const { data: expenses } = await expenseQuery;

  const breakdown: ExpenseBreakdown = {
    rawMaterial: 0,
    operationalDaily: 0,
    salary: 0,
    rent: 0,
    household: 0,
    environment: 0,
    other: 0,
    marketing: 0,
    administration: 0,
    depreciation: 0,
    interest: 0,
    tax: 0
  };

  (expenses || []).forEach((expense: any) => {
    const amount = Number(expense.amount || 0);
    const type = (expense.expense_type || '').toLowerCase();

    // Map expense types to categories
    if (type.includes('food') || type.includes('bahan')) {
      breakdown.rawMaterial += amount;
    } else if (type.includes('operational') || type.includes('operasional')) {
      breakdown.operationalDaily += amount;
    } else if (type.includes('salary') || type.includes('gaji')) {
      breakdown.salary += amount;
    } else if (type.includes('rent') || type.includes('sewa')) {
      breakdown.rent += amount;
    } else if (type.includes('household') || type.includes('rumah tangga')) {
      breakdown.household += amount;
    } else if (type.includes('environment') || type.includes('lingkungan')) {
      breakdown.environment += amount;
    } else if (type.includes('marketing')) {
      breakdown.marketing += amount;
    } else if (type.includes('administration') || type.includes('administrasi')) {
      breakdown.administration += amount;
    } else {
      breakdown.other += amount;
    }
  });

  return breakdown;
};

export const calculateNetProfit = (
  revenue: RevenueBreakdown,
  rawMaterialCost: number,
  expenses: ExpenseBreakdown
): number => {
  const totalRevenue = revenue.cash + revenue.qris + revenue.transfer;
  const grossProfit = totalRevenue - revenue.mdr;
  const totalExpenses = rawMaterialCost + 
    expenses.operationalDaily + expenses.salary + expenses.rent + 
    expenses.household + expenses.environment + expenses.other +
    expenses.marketing + expenses.administration + 
    expenses.depreciation + expenses.interest + expenses.tax;
  
  return grossProfit - totalExpenses;
};