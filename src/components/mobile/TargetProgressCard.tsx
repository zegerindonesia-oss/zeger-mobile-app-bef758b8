import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

interface TargetProgressCardProps {
  currentSales: number;
  filterPeriod: string;
  startDate?: string;
  endDate?: string;
}

const DAILY_TARGET = 500000;
const WEEKLY_TARGET = 3500000;
const MONTHLY_TARGET = 15000000;

const getTarget = (period: string, startDate?: string, endDate?: string): number => {
  switch (period) {
    case 'today':
    case 'yesterday':
      return DAILY_TARGET;
    case 'week':
    case 'weekly':
      return WEEKLY_TARGET;
    case 'month':
    case 'monthly':
      return MONTHLY_TARGET;
    case 'custom':
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return days * DAILY_TARGET;
      }
      return DAILY_TARGET;
    default:
      return DAILY_TARGET;
  }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const TargetProgressCard = ({ 
  currentSales, 
  filterPeriod, 
  startDate, 
  endDate 
}: TargetProgressCardProps) => {
  const target = getTarget(filterPeriod, startDate, endDate);
  const percentage = Math.min(Math.round((currentSales / target) * 100), 100);
  const actualPercentage = Math.round((currentSales / target) * 100);

  return (
    <Card className="bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white border-0 shadow-lg">
      <CardContent className="p-4 space-y-4">
        {/* Motivational Text */}
        <div className="text-center">
          <p className="text-base font-semibold">
            Bismillah Allah mudahkan, Yuk Semangat Capai Targetmu
          </p>
        </div>

        {/* Percentage Display */}
        <div className="flex items-center justify-center gap-2">
          <Target className="h-6 w-6" />
          <span className="text-4xl font-bold">{actualPercentage}%</span>
        </div>

        {/* Progress Bar with Gradient and Glow */}
        <div className="space-y-2">
          <div className="relative h-6 w-full overflow-hidden rounded-full bg-white shadow-lg">
            <div 
              className="h-full rounded-full transition-all duration-500 ease-out relative"
              style={{ 
                width: `${percentage}%`,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.95) 0%, rgba(255,220,220,0.9) 40%, rgba(239,68,68,1) 100%)',
                boxShadow: '0 0 15px rgba(255,255,255,0.8), 0 0 30px rgba(239,68,68,0.5), inset 0 2px 0 rgba(255,255,255,0.5)'
              }}
            >
              {/* Circle indicator at the end */}
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-white"
                style={{
                  boxShadow: '0 0 20px rgba(255,255,255,1), 0 0 40px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.15)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Sales Info */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs opacity-75">Omset Saat Ini</p>
            <p className="text-lg font-bold">{formatCurrency(currentSales)}</p>
          </div>
          <div>
            <p className="text-xs opacity-75">Target</p>
            <p className="text-lg font-bold">{formatCurrency(target)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
