import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";
import { getTodayJakarta } from "@/lib/date";

interface DateFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  showUserFilter?: boolean;
  selectedUser?: string;
  onUserChange?: (userId: string) => void;
  users?: Array<{ id: string; full_name: string }>;
  userLabel?: string;
  showQuickFilters?: boolean;
  className?: string;
}

export const DateFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  showUserFilter = false,
  selectedUser = "all",
  onUserChange,
  users = [],
  userLabel = "User",
  showQuickFilters = true,
  className = ""
}: DateFilterProps) => {
  
  const getJakartaDate = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  };

  const formatYMD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleQuickFilter = (type: 'today' | 'week' | 'month') => {
    const now = getJakartaDate();
    const today = formatYMD(now);

    switch (type) {
      case 'today':
        onStartDateChange(today);
        onEndDateChange(today);
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        onStartDateChange(formatYMD(weekStart));
        onEndDateChange(today);
        break;
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        onStartDateChange(formatYMD(monthStart));
        onEndDateChange(today);
        break;
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filter Data
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Quick Filter Buttons */}
          {showQuickFilters && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('today')}
                className="text-xs"
              >
                Hari Ini
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('week')}
                className="text-xs"
              >
                Minggu Ini
              </Button>
              <Button
                variant="outline" 
                size="sm"
                onClick={() => handleQuickFilter('month')}
                className="text-xs"
              >
                Bulan Ini
              </Button>
            </div>
          )}

          <div className={`grid gap-4 ${showUserFilter ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
            {/* User Filter */}
            {showUserFilter && onUserChange && (
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{userLabel}</Label>
                <Select value={selectedUser} onValueChange={onUserChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Pilih ${userLabel.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua {userLabel}</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Range */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Tanggal Mulai</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Tanggal Akhir</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};