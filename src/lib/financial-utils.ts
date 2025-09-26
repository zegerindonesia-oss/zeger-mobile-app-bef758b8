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
  
  // Use Asia/Jakarta timezone
  const startDateTime = `${startStr}T00:00:00+07:00`;
  const endDateTime = `${endStr}T23:59:59+07:00`;

  let transQuery = supabase
    .from('transactions')
    .select('final_amount, payment_method')
    .eq('status', 'completed')
    .gte('transaction_date', startDateTime)
    .lte('transaction_date', endDateTime);

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
  
  // Use Asia/Jakarta timezone
  const startDateTime = `${startStr}T00:00:00+07:00`;
  const endDateTime = `${endStr}T23:59:59+07:00`;

  // Use join to avoid URL length issues and pagination
  let itemsQuery = supabase
    .from('transaction_items')
    .select(`
      quantity, 
      products!inner(cost_price),
      transactions!inner(status, transaction_date, rider_id)
    `)
    .eq('transactions.status', 'completed')
    .gte('transactions.transaction_date', startDateTime)
    .lte('transactions.transaction_date', endDateTime);

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
  selectedRider?: string
): Promise<SalesData> => {
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  // Build base query with pagination and proper timezone (+07:00)
  const baseFilters = (q: any) => {
    q = q
      .eq('status', 'completed')
      .gte('transaction_date', `${startStr}T00:00:00+07:00`)
      .lte('transaction_date', `${endStr}T23:59:59+07:00`);
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