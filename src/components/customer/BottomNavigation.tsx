import { Home, Ticket, ReceiptText, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavigationProps {
  activeView: string;
  activeOrdersCount: number;
  onNavigate: (view: string) => void;
}

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'vouchers', label: 'Voucher', icon: Ticket, match: ['vouchers', 'promo-reward'] },
  { id: 'orders', label: 'Pesanan', icon: ReceiptText },
  { id: 'profile', label: 'Akun', icon: User },
];

export function BottomNavigation({ activeView, activeOrdersCount, onNavigate }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-around py-2">
        {TABS.map((t) => {
          const active = (t.match || [t.id]).includes(activeView);
          return (
            <button key={t.id} onClick={() => onNavigate(t.id)}
              className={cn('relative flex flex-col items-center px-4 py-1.5', active ? 'text-zeger' : 'text-muted-foreground')}>
              <t.icon className={cn('h-6 w-6', active && 'fill-zeger/20')} />
              <span className={cn('mt-1 text-xs', active && 'font-bold')}>{t.label}</span>
              {t.id === 'orders' && activeOrdersCount > 0 && (
                <span className="absolute right-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-zeger px-1 text-[10px] font-bold text-zeger-foreground">{activeOrdersCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavigation;
