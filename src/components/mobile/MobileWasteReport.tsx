import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Trash2, Calendar, Package, AlertTriangle, TrendingDown } from 'lucide-react';
import { getTodayJakarta } from '@/lib/date';
import { format, subDays, startOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

type PeriodFilter = 'today' | 'yesterday' | 'this_month' | 'custom';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

export default function MobileWasteReport() {
  const { userProfile } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = useMemo(() => {
    const today = getTodayJakarta();
    switch (period) {
      case 'today':
        return { start: `${today}T00:00:00+07:00`, end: `${today}T23:59:59+07:00` };
      case 'yesterday': {
        const yesterday = format(subDays(new Date(today), 1), 'yyyy-MM-dd');
        return { start: `${yesterday}T00:00:00+07:00`, end: `${yesterday}T23:59:59+07:00` };
      }
      case 'this_month': {
        const monthStart = format(startOfMonth(new Date(today)), 'yyyy-MM-dd');
        return { start: `${monthStart}T00:00:00+07:00`, end: `${today}T23:59:59+07:00` };
      }
      case 'custom':
        if (customStart && customEnd) {
          return { start: `${customStart}T00:00:00+07:00`, end: `${customEnd}T23:59:59+07:00` };
        }
        return { start: `${today}T00:00:00+07:00`, end: `${today}T23:59:59+07:00` };
      default:
        return { start: `${today}T00:00:00+07:00`, end: `${today}T23:59:59+07:00` };
    }
  }, [period, customStart, customEnd]);

  const { data: wasteData, isLoading } = useQuery({
    queryKey: ['rider-waste', userProfile?.id, dateRange],
    queryFn: async () => {
      if (!userProfile?.id) return [];
      const { data, error } = await supabase
        .from('product_waste')
        .select(`
          id, quantity, hpp, total_waste, waste_reason, notes, created_at,
          products:product_id (name, code)
        `)
        .eq('rider_id', userProfile.id)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userProfile?.id,
  });

  const summary = useMemo(() => {
    if (!wasteData?.length) return { totalItems: 0, totalQty: 0, totalValue: 0 };
    return {
      totalItems: wasteData.length,
      totalQty: wasteData.reduce((sum, w) => sum + w.quantity, 0),
      totalValue: wasteData.reduce((sum, w) => sum + (Number(w.total_waste) || 0), 0),
    };
  }, [wasteData]);

  const reasonLabel = (reason: string) => {
    const map: Record<string, string> = {
      expired: 'Expired', damaged: 'Rusak', unsold: 'Tidak Terjual',
      quality: 'Kualitas', other: 'Lainnya',
    };
    return map[reason] || reason;
  };

  return (
    <div className="p-4 space-y-4 bg-gradient-to-br from-white via-red-50/30 to-white min-h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-red-600" />
        <h2 className="text-lg font-semibold">Laporan Waste</h2>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap gap-2">
        {([
          ['today', 'Hari Ini'],
          ['yesterday', 'Kemarin'],
          ['this_month', 'Bulan Ini'],
          ['custom', 'Custom'],
        ] as [PeriodFilter, string][]).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={period === key ? 'default' : 'outline'}
            onClick={() => setPeriod(key)}
            className="text-xs"
          >
            {label}
          </Button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex gap-2">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-3 flex flex-col items-center text-center">
            <Package className="h-5 w-5 text-orange-500 mb-1" />
            <p className="text-lg font-bold">{summary.totalItems}</p>
            <p className="text-xs text-muted-foreground">Item</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-3 flex flex-col items-center text-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mb-1" />
            <p className="text-lg font-bold">{summary.totalQty}</p>
            <p className="text-xs text-muted-foreground">Total Qty</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-3 flex flex-col items-center text-center">
            <TrendingDown className="h-5 w-5 text-red-500 mb-1" />
            <p className="text-sm font-bold truncate w-full">{formatCurrency(summary.totalValue)}</p>
            <p className="text-xs text-muted-foreground">Total Waste</p>
          </CardContent>
        </Card>
      </div>

      {/* Waste List */}
      {isLoading ? (
        <LoadingSpinner message="Memuat data waste..." />
      ) : !wasteData?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Trash2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Tidak ada data waste untuk periode ini</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {wasteData.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {(item.products as any)?.name || 'Produk'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 ml-2">
                    {reasonLabel(item.waste_reason)}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Qty</p>
                    <p className="font-semibold">{item.quantity}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">HPP</p>
                    <p className="font-semibold">{formatCurrency(Number(item.hpp))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold text-red-600">{formatCurrency(Number(item.total_waste) || 0)}</p>
                  </div>
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">📝 {item.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
