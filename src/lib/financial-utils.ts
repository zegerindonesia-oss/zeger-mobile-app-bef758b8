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
  selectedRider?: string,
  branchId?: string
): Promise<RevenueBreakdown> => {
  // Use centralized sales calculation for consistency
  const salesData = await calculateSalesData(startDate, endDate, selectedRider, branchId);
  
  // Calculate MDR only on QRIS payments (0.7%)
  const mdrAmount = salesData.salesByPaymentMethod.qris * 0.007;

  return {
    cash: salesData.salesByPaymentMethod.cash,
    qris: salesData.salesByPaymentMethod.qris,
    transfer: salesData.salesByPaymentMethod.transfer,
    mdr: mdrAmount
  };
};

export const calculateRawMaterialCost = async (
  startDate: Date,
  endDate: Date,
  selectedRider?: string,
  branchId?: string
): Promise<number> => {
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  
  // Use Asia/Jakarta timezone
  const startDateTime = `${startStr}T00:00:00+07:00`;
  const endDateTime = `${endStr}T23:59:59+07:00`;

  // Use join to avoid URL length issues and pagination
  let itemsQuery = supabase
    .from('transaction_items')
    .select(`
      quantity, 
      products!inner(cost_price),
      transactions!inner(status, transaction_date, rider_id, branch_id, is_voided)
    `)
    .eq('transactions.status', 'completed')
    .eq('transactions.is_voided', false)
    .gte('transactions.transaction_date', startDateTime)
    .lte('transactions.transaction_date', endDateTime);

  if (branchId) {
    itemsQuery = itemsQuery.eq('transactions.branch_id', branchId);
  }

  if (selectedRider && selectedRider !== "all") {
    itemsQuery = itemsQuery.eq('transactions.rider_id', selectedRider);
  }

  // Handle pagination for large datasets
  let totalCost = 0;
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: itemsBatch } = await itemsQuery.range(from, from + batchSize - 1);
    
    if (!itemsBatch || itemsBatch.length === 0) break;
    
    const batchCost = itemsBatch.reduce((sum, item: any) => 
      sum + (item.quantity || 0) * (Number(item.products?.cost_price) || 0), 0
    );
    
    totalCost += batchCost;
    
    if (itemsBatch.length < batchSize) break;
    
    from += batchSize;
  }

  return totalCost;
};

// Map existing granular expense types to standardized categories
const mapExpenseToCategory = (expenseType: string): keyof ExpenseBreakdown => {
  const type = expenseType.toLowerCase();
  
  // Beban Operasional Harian (daily operational expenses)
  if (type.includes('es batu') || type.includes('plastik') || type.includes('sedotan') || 
      type.includes('tissue') || type.includes('food') || type.includes('balleys') ||
      type.includes('waste') || type.includes('pompa') || type.includes('angin') ||
      type.includes('parkir') || type.includes('kunci') || type.includes('daily') ||
      type.includes('operasional') || type.includes('operational')) {
    return 'operationalDaily';
  }
  
  // Beban Lingkungan (environmental expenses)
  if (type.includes('iuran') || type.includes('kebersihan') || type.includes('mcg') ||
      type.includes('pedagang') || type.includes('taman') || type.includes('sekardangan') ||
      type.includes('environment') || type.includes('lingkungan')) {
    return 'environment';
  }
  
  // Beban Gaji Karyawan (salary)
  if (type.includes('gaji') || type.includes('salary')) {
    return 'salary';
  }
  
  // Beban Sewa (rent)
  if (type.includes('sewa') || type.includes('rent')) {
    return 'rent';
  }
  
  // Beban Rumah Tangga (household)
  if (type.includes('listrik') || type.includes('air') || type.includes('utilities') || 
      type.includes('rumah tangga') || type.includes('household')) {
    return 'household';
  }
  
  // Raw Material (food/ingredients)
  if (type.includes('bahan') || type.includes('ingredient')) {
    return 'rawMaterial';
  }
  
  // Marketing
  if (type.includes('marketing')) {
    return 'marketing';
  }
  
  // Administration
  if (type.includes('administrasi') || type.includes('administration')) {
    return 'administration';
  }
  
  // Default to others
  return 'other';
};

export const calculateOperationalExpenses = async (
  startDate: Date,
  endDate: Date,
  selectedRider?: string,
  branchId?: string
): Promise<ExpenseBreakdown> => {
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  // Fetch operational expenses from operational_expenses table
  let opQuery = supabase
    .from('operational_expenses')
    .select('amount, expense_category, created_by, branch_id')
    .gte('expense_date', startStr)
    .lte('expense_date', endStr);

  if (branchId) {
    opQuery = opQuery.eq('branch_id', branchId);
  }

  if (selectedRider && selectedRider !== "all") {
    opQuery = opQuery.eq('created_by', selectedRider);
  }

  const { data: operationalExpenses } = await opQuery;

  // Fetch daily operational expenses (rider expenses) with pagination
  const batchSize = 1000;
  let from = 0;
  let allRiderExpenses: any[] = [];
  
  while (true) {
    let riderQuery = supabase
      .from('daily_operational_expenses')
      .select('amount, expense_type, rider_id')
      .gte('expense_date', startStr)
      .lte('expense_date', endStr);

    if (selectedRider && selectedRider !== "all") {
      riderQuery = riderQuery.eq('rider_id', selectedRider);
    }

    const { data: batch } = await riderQuery.range(from, from + batchSize - 1);
    if (!batch || batch.length === 0) break;
    
    allRiderExpenses.push(...batch);
    if (batch.length < batchSize) break;
    from += batchSize;
  }

  // Initialize expense breakdown
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

  // Process operational expenses using standardized mapping
  (operationalExpenses || []).forEach((expense: any) => {
    const amount = Number(expense.amount || 0);
    const category = mapExpenseToCategory(expense.expense_category || '');
    breakdown[category] += amount;
  });

  // Process daily operational expenses (rider expenses) using standardized mapping
  allRiderExpenses.forEach((expense: any) => {
    const amount = Number(expense.amount || 0);
    const category = mapExpenseToCategory(expense.expense_type || '');
    breakdown[category] += amount;
  });

  return breakdown;
};

// === Rider salary calculation (sync with RiderIncome page) ===
// Daily attendance commission + tiered weekly sales commission - waste
// Excludes kasbon (manual input, not persisted).
const RIDER_DAILY_COMMISSION = 30000;
const RIDER_COMMISSION_TIERS = [
  { min: 6000000, rate: 0.175 },
  { min: 5500000, rate: 0.17 },
  { min: 5000000, rate: 0.165 },
  { min: 4500000, rate: 0.16 },
  { min: 4000000, rate: 0.155 },
  { min: 3500000, rate: 0.15 },
  { min: 3000000, rate: 0.14 },
  { min: 2500000, rate: 0.13 },
  { min: 2000000, rate: 0.11 },
  { min: 1500000, rate: 0.08 },
  { min: 1000000, rate: 0.05 },
];
const getRiderCommissionRate = (weeklyRevenue: number): number => {
  for (const t of RIDER_COMMISSION_TIERS) if (weeklyRevenue >= t.min) return t.rate;
  return 0;
};
const getMondayLocal = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};
const getSundayLocal = (monday: Date): Date => {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  return sun;
};

export const calculateRiderSalary = async (
  startDate: Date,
  endDate: Date,
  selectedRider?: string,
  branchId?: string
): Promise<number> => {
  const filterStart = new Date(startDate);
  filterStart.setHours(0, 0, 0, 0);
  const filterEnd = new Date(endDate);
  filterEnd.setHours(0, 0, 0, 0);

  // Expand to full weeks (Mon-Sun) covering filter so weekly tier is correct
  const weekStart = getMondayLocal(filterStart);
  const lastMon = getMondayLocal(filterEnd);
  const weekEnd = getSundayLocal(lastMon);

  const txStartStr = formatDate(weekStart);
  const txEndStr = formatDate(weekEnd);

  // Fetch transactions (paginated)
  const fetchAll = async (q: any) => {
    const all: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await q.range(from, from + 999);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return all;
  };

  let txQ = supabase
    .from('transactions')
    .select('rider_id, final_amount, transaction_date')
    .eq('status', 'completed')
    .eq('is_voided', false)
    .gte('transaction_date', `${txStartStr}T00:00:00+07:00`)
    .lte('transaction_date', `${txEndStr}T23:59:59+07:00`);
  if (branchId) txQ = txQ.eq('branch_id', branchId);
  if (selectedRider && selectedRider !== 'all') txQ = txQ.eq('rider_id', selectedRider);

  const startStr = formatDate(filterStart);
  const endStr = formatDate(filterEnd);

  let wasteQ = supabase
    .from('product_waste')
    .select('rider_id, total_waste, created_at')
    .gte('created_at', `${startStr}T00:00:00+07:00`)
    .lte('created_at', `${endStr}T23:59:59+07:00`);
  if (branchId) wasteQ = wasteQ.eq('branch_id', branchId);
  if (selectedRider && selectedRider !== 'all') wasteQ = wasteQ.eq('rider_id', selectedRider);

  const [tx, waste] = await Promise.all([fetchAll(txQ), fetchAll(wasteQ)]);

  // Build daily sales per rider, weekly revenue per rider
  const dailySales = new Map<string, Map<string, number>>();
  const weeklyRevenue = new Map<string, Map<string, number>>();
  tx.forEach((t: any) => {
    if (!t.rider_id) return;
    const dateStr = String(t.transaction_date).split('T')[0];
    const amt = Number(t.final_amount || 0);
    if (!dailySales.has(t.rider_id)) dailySales.set(t.rider_id, new Map());
    const ds = dailySales.get(t.rider_id)!;
    ds.set(dateStr, (ds.get(dateStr) || 0) + amt);
    const monday = getMondayLocal(new Date(dateStr + 'T00:00:00'));
    const wk = formatDate(monday);
    if (!weeklyRevenue.has(t.rider_id)) weeklyRevenue.set(t.rider_id, new Map());
    const wr = weeklyRevenue.get(t.rider_id)!;
    wr.set(wk, (wr.get(wk) || 0) + amt);
  });

  // Waste per rider in filter range
  const wasteByRider = new Map<string, number>();
  waste.forEach((w: any) => {
    if (!w.rider_id) return;
    wasteByRider.set(w.rider_id, (wasteByRider.get(w.rider_id) || 0) + Number(w.total_waste || 0));
  });

  // Sales-commission lump sum credited to last working day in range (per week)
  const salesCommissionByRider = new Map<string, number>();
  weeklyRevenue.forEach((weeks, riderId) => {
    weeks.forEach((revenue, weekMonday) => {
      const rate = getRiderCommissionRate(revenue);
      const totalComm = revenue * rate;
      if (!totalComm) return;
      const monday = new Date(weekMonday + 'T00:00:00');
      let lastInRange: string | null = null;
      for (let i = 6; i >= 0; i--) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        const ds = formatDate(day);
        if (ds >= startStr && ds <= endStr) { lastInRange = ds; break; }
      }
      if (!lastInRange) return;
      salesCommissionByRider.set(riderId, (salesCommissionByRider.get(riderId) || 0) + totalComm);
    });
  });

  // Daily attendance commission (only for days in filter range with sales > 0)
  const dailyCommissionByRider = new Map<string, number>();
  dailySales.forEach((days, riderId) => {
    let total = 0;
    days.forEach((amt, ds) => {
      if (ds >= startStr && ds <= endStr && amt > 0) total += RIDER_DAILY_COMMISSION;
    });
    if (total) dailyCommissionByRider.set(riderId, total);
  });

  // Aggregate
  const allRiderIds = new Set<string>([
    ...dailyCommissionByRider.keys(),
    ...salesCommissionByRider.keys(),
    ...wasteByRider.keys(),
  ]);
  let total = 0;
  allRiderIds.forEach((rid) => {
    const dc = dailyCommissionByRider.get(rid) || 0;
    const sc = salesCommissionByRider.get(rid) || 0;
    const w = wasteByRider.get(rid) || 0;
    total += dc + sc - w;
  });
  return Math.max(0, total);
};

export interface SalesData {
  grossSales: number;
  netSales: number;  
  totalDiscount: number;
  totalTransactions: number;
  totalItems: number;
  salesByPaymentMethod: {
    cash: number;
    qris: number;
    transfer: number;
  };
  averageSalePerTransaction: number;
}

export const calculateSalesData = async (
  startDate: Date,
  endDate: Date,
  selectedRider?: string,
  branchId?: string
): Promise<SalesData> => {
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  // Build base query with pagination and proper timezone (+07:00)
  const baseFilters = (q: any) => {
    q = q
      .eq('status', 'completed')
      .eq('is_voided', false)
      .gte('transaction_date', `${startStr}T00:00:00+07:00`)
      .lte('transaction_date', `${endStr}T23:59:59+07:00`);
    
    // Branch filtering for branch managers and small branch managers
    if (branchId) {
      q = q.eq('branch_id', branchId);
    }
    
    if (selectedRider && selectedRider !== "all") {
      q = q.eq('rider_id', selectedRider);
    }
    return q;
  };

  // Get total count accurately (not limited by 1000)
  const { count: totalCount } = await baseFilters(
    supabase.from('transactions').select('id', { count: 'exact', head: true })
  );

  // Paginate through all transactions to avoid the 1000 row limit
  const batchSize = 1000;
  let from = 0;
  const allTransactions: any[] = [];
  while (true) {
    let q = baseFilters(
      supabase
        .from('transactions')
        .select(`
          id,
          final_amount,
          payment_method,
          discount_amount,
          transaction_items (
            quantity,
            unit_price,
            total_price
          )
        `)
    );

    const { data: batch } = await q.range(from, from + batchSize - 1);
    if (!batch || batch.length === 0) break;
    allTransactions.push(...batch);
    if (batch.length < batchSize) break;
    from += batchSize;
  }

  const transactions = allTransactions;

  if (!transactions || transactions.length === 0) {
    return {
      grossSales: 0,
      netSales: 0,
      totalDiscount: 0,
      totalTransactions: 0,
      totalItems: 0,
      salesByPaymentMethod: {
        cash: 0,
        qris: 0,
        transfer: 0
      },
      averageSalePerTransaction: 0
    };
  }

  // Calculate sales data
  let grossSales = 0;
  let netSales = 0;
  let totalDiscounts = 0;
  let totalItems = 0;
  let cashSales = 0;
  let qrisSales = 0;
  let transferSales = 0;

  transactions.forEach((transaction: any) => {
    const finalAmount = Number(transaction.final_amount || 0);
    const discountAmount = Number(transaction.discount_amount || 0);
    const paymentMethod = normalizePaymentMethod(transaction.payment_method);
    
    // Calculate gross sales from transaction items
    const transactionGross = transaction.transaction_items?.reduce((sum: number, item: any) => 
      sum + (Number(item.unit_price || 0) * Number(item.quantity || 0)), 0
    ) || 0;
    
    // Calculate total items
    const transactionItems = transaction.transaction_items?.reduce((sum: number, item: any) => 
      sum + Number(item.quantity || 0), 0
    ) || 0;

    grossSales += transactionGross;
    netSales += finalAmount;
    totalDiscounts += discountAmount;
    totalItems += transactionItems;

    // Payment method breakdown (using final_amount for consistency)
    if (paymentMethod === 'cash') {
      cashSales += finalAmount;
    } else if (paymentMethod === 'qris') {
      qrisSales += finalAmount;
    } else if (paymentMethod === 'transfer') {
      transferSales += finalAmount;
    }
  });

  const totalTransactions = transactions.length;
  const averageSalePerTransaction = totalTransactions > 0 ? netSales / totalTransactions : 0;

  return {
    grossSales,
    netSales,
    totalDiscount: totalDiscounts,
    totalTransactions,
    totalItems,
    salesByPaymentMethod: {
      cash: cashSales,
      qris: qrisSales,
      transfer: transferSales
    },
    averageSalePerTransaction
  };
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