import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const salesData = [
  { day: "Sen", sales: 2400000, orders: 45 },
  { day: "Sel", sales: 1398000, orders: 32 },
  { day: "Rab", sales: 9800000, orders: 87 },
  { day: "Kam", sales: 3908000, orders: 56 },
  { day: "Jum", sales: 4800000, orders: 78 },
  { day: "Sab", sales: 3800000, orders: 65 },
  { day: "Min", sales: 4300000, orders: 72 }
];

export const SalesChart = () => {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="day" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
            }}
            formatter={(value, name) => [
              `Rp ${value.toLocaleString('id-ID')}`,
              name === 'sales' ? 'Pendapatan' : 'Pesanan'
            ]}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="hsl(var(--primary))"
            fillOpacity={1}
            fill="url(#salesGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};