import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, LogOut, Receipt, DoorClosed, Plus, Minus, Monitor } from 'lucide-react';
import { ZegerLogo } from '@/components/ui/zeger-logo';
import { useNavigate } from 'react-router-dom';

interface Props {
  branchName: string;
  kasirName: string;
  shiftType?: string;
  online: boolean;
  onCloseShift: () => void;
  onCashMovement: () => void;
  onLogout: () => void;
  rightExtra?: React.ReactNode;
}

export const POSHeader = ({ branchName, kasirName, shiftType, online, onCloseShift, onCashMovement, onLogout, rightExtra }: Props) => {
  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center justify-between gap-4 border-b bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        <ZegerLogo size="sm" className="text-primary" />
        <div className="leading-tight">
          <div className="font-semibold text-sm">{branchName}</div>
          <div className="text-xs text-muted-foreground">
            Kasir: {kasirName} {shiftType ? `· Shift ${shiftType}` : ''}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm font-mono">{now.toLocaleTimeString('id-ID')}</div>
        <Badge variant={online ? 'default' : 'destructive'} className="gap-1">
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {online ? 'Online' : 'Offline'}
        </Badge>
        {rightExtra}
        <Button size="sm" variant="outline" onClick={() => navigate('/pos/kds')} title="Kitchen Display">
          <Monitor className="h-3 w-3" /> KDS
        </Button>
        <Button size="sm" variant="outline" onClick={onCashMovement}>
          <Plus className="h-3 w-3" /> Kas
        </Button>
        <Button size="sm" variant="outline" onClick={onCloseShift}>
          <DoorClosed className="h-3 w-3" /> Tutup Shift
        </Button>
        <Button size="sm" variant="ghost" onClick={onLogout}>
          <LogOut className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
