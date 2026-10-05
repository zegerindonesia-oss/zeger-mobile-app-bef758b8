import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, Monitor, Tv, LayoutDashboard, Package, Users, BarChart3, Tag, Gift,
  Settings, LogOut, Banknote, DoorClosed, Boxes, Headphones, UserCog, Receipt,
} from 'lucide-react';
import { ZegerLogo } from '@/components/ui/zeger-logo';
import { cn } from '@/lib/utils';

type Level = 'ho' | 'manager' | 'kasir' | 'finance';

const levelOf = (role?: string): Level => {
  if (!role) return 'kasir';
  if (['ho_admin', 'ho_owner', '1_HO_Admin', '1_HO_Owner', 'ho_staff', '1_HO_Staff'].includes(role)) return 'ho';
  if (['branch_manager', 'sb_branch_manager', '2_Hub_Branch_Manager', '3_SB_Branch_Manager'].includes(role)) return 'manager';
  if (role === 'finance') return 'finance';
  return 'kasir';
};

interface Item { label: string; icon: any; path?: string; action?: () => void; levels: Level[]; }

interface Props {
  collapsed: boolean;
  role?: string;
  userName: string;
  branchName: string;
  onCashMovement: () => void;
  onCloseShift: () => void;
  onLogout: () => void;
}

export const POSSidebar = ({ collapsed, role, userName, branchName, onCashMovement, onCloseShift, onLogout }: Props) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const lvl = levelOf(role);
  const all: Level[] = ['ho', 'manager', 'kasir', 'finance'];

  const items = ([
    { label: 'Kasir (POS)', icon: ShoppingCart, path: '/pos', levels: all },
    { label: 'Kitchen Display', icon: Monitor, path: '/pos/kds', levels: all },
    { label: 'Layar Antrean TV', icon: Tv, path: '/pos/queue', levels: all },
    { label: 'Kas Masuk/Keluar', icon: Banknote, action: onCashMovement, levels: all },
    { label: 'Tutup Shift', icon: DoorClosed, action: onCloseShift, levels: all },
    { label: 'Dashboard ERP', icon: LayoutDashboard, path: '/admin', levels: ['ho', 'manager', 'finance'] },
    { label: 'Transaksi', icon: Receipt, path: '/transactions', levels: ['ho', 'manager', 'finance'] },
    { label: 'Produk', icon: Package, path: '/master/products', levels: ['ho', 'manager'] },
    { label: 'Stok', icon: Boxes, path: '/inventory', levels: ['ho', 'manager'] },
    { label: 'Bahan & Resep', icon: Package, path: '/inventory/raw-materials', levels: ['ho', 'manager'] },
    { label: 'Pelanggan', icon: Users, path: '/customers', levels: ['ho', 'manager'] },
    { label: 'Promo', icon: Tag, path: '/settings/promo-management', levels: ['ho', 'manager'] },
    { label: 'Loyalty', icon: Gift, path: '/settings/app-management/loyalty', levels: ['ho', 'manager'] },
    { label: 'Laporan', icon: BarChart3, path: '/finance/profit-loss', levels: ['ho', 'finance'] },
    { label: 'Pengguna', icon: UserCog, path: '/settings/users', levels: ['ho', 'manager'] },
    { label: 'Pengaturan', icon: Settings, path: '/settings/app-management', levels: ['ho'] },
  ] as Item[]).filter((i) => i.levels.includes(lvl));

  return (
    <aside className={cn('glass-sidebar h-screen flex flex-col text-primary-foreground transition-all duration-300 shrink-0', collapsed ? 'w-[76px]' : 'w-[240px]')}>
      <div className={cn('flex items-center gap-2 px-4 h-16', collapsed && 'justify-center px-0')}>
        <ZegerLogo size="sm" className="text-primary-foreground" />
        {!collapsed && <span className="font-bold text-lg tracking-tight">Zeger POS</span>}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-1 py-2">
        {items.map((it) => {
          const active = it.path && pathname === it.path;
          const Icon = it.icon;
          return (
            <button
              key={it.label}
              title={it.label}
              onClick={() => (it.action ? it.action() : navigate(it.path!))}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                collapsed && 'justify-center px-0',
                active ? 'glass-pill-active' : 'text-primary-foreground/85 hover:bg-primary-foreground/15',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{it.label}</span>}
            </button>
          );
        })}
      </nav>
      <div className="p-3 space-y-2">
        {!collapsed && (
          <div className="rounded-xl bg-primary-foreground/12 border border-primary-foreground/20 px-3 py-2 flex items-center gap-2">
            <Headphones className="h-4 w-4" />
            <div className="leading-tight">
              <div className="text-xs font-semibold">Butuh bantuan?</div>
              <div className="text-[11px] opacity-80">{branchName}</div>
            </div>
          </div>
        )}
        <div className={cn('rounded-xl bg-primary-foreground/12 border border-primary-foreground/20 p-2 flex items-center gap-2', collapsed && 'justify-center')}>
          <div className="h-8 w-8 rounded-full bg-primary-foreground text-primary flex items-center justify-center text-sm font-bold shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-sm font-semibold truncate">{userName}</div>
              <div className="text-[11px] opacity-80 truncate">{role}</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={onLogout} title="Keluar" className="p-1.5 rounded-lg hover:bg-primary-foreground/20">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
