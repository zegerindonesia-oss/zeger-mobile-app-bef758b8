import { Home, Ticket, ReceiptText, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavigationProps {
  activeView: string;
  activeOrdersCount: number;
  onNavigate: (view: string) => void;
}

const TABS = [
  { id: 'home', label: 'Home', icon: Home, match: ['home', 'menu', 'outlets', 'map', 'street', 'product-detail'] },
  { id: 'vouchers', label: 'Voucher', icon: Ticket, match: ['vouchers', 'promo-reward', 'loyalty', 'subscription', 'referral'] },
  { id: 'orders', label: 'Pesanan', icon: ReceiptText, match: ['orders', 'order-tracking'] },
  { id: 'profile', label: 'Akun', icon: User, match: ['profile', 'care', 'notifications'] },
];

export function BottomNavigation({ activeView, activeOrdersCount, onNavigate }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="cx-dock mx-auto flex max-w-md items-stretch justify-around rounded-t-[26px] px-1.5 pt-1.5 pb-1">
        {TABS.map((t) => {
          const active = (t.match || [t.id]).includes(activeView);
          return (
            <button
              key={t.id}
              onClick={() => onNavigate(t.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'cx-dock-item relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2',
                active ? 'text-zeger' : 'text-muted-foreground',
              )}
            >
              {active && <span className="cx-dock-glow absolute inset-0 rounded-2xl" aria-hidden />}
              <span className="relative">
                <t.icon className={cn('h-[22px] w-[22px] transition-transform', active && 'scale-110')} strokeWidth={active ? 2.5 : 2} />
                {t.id === 'orders' && activeOrdersCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-zeger px-1 text-[10px] font-bold text-zeger-foreground shadow-[0_2px_6px_-1px_hsl(var(--zeger)/0.7)]">
                    {activeOrdersCount > 9 ? '9+' : activeOrdersCount}
                  </span>
                )}
              </span>
              <span className={cn('relative text-[11px] leading-none', active ? 'font-bold' : 'font-medium')}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavigation;
