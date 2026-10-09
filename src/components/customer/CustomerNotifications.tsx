import { useEffect, useState } from 'react';
import { ChevronLeft, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Props { customerUser: any; onBack: () => void; }
interface Notif {
  id: string; title: string; body: string | null; link: string | null;
  read_at: string | null; created_at: string; user_id: string | null;
}

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function CustomerNotifications({ customerUser, onBack }: Props) {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('customer_notifications')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${customerUser?.id}`)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!alive) return;
      setItems((data as any) || []);
      setLoading(false);
      const unread = (data || []).filter((n: any) => n.user_id === customerUser?.id && !n.read_at).map((n: any) => n.id);
      if (unread.length) {
        await supabase.from('customer_notifications').update({ read_at: new Date().toISOString() }).in('id', unread);
      }
    })();
    return () => { alive = false; };
  }, [customerUser?.id]);

  return (
    <div className="cx-app min-h-screen pb-28">
      <header className="cx-bar sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="cx-icon-btn h-10 w-10" aria-label="Kembali">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Notifikasi</h1>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          [0, 1, 2].map((i) => <div key={i} className="cx-shimmer h-20 rounded-3xl" />)
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="cx-stage h-24 w-24 rounded-3xl mx-auto flex items-center justify-center mb-4">
              <Bell className="h-10 w-10 text-zeger" />
            </div>
            <p className="font-bold">Belum ada notifikasi</p>
            <p className="text-sm text-muted-foreground mt-1">Promo dan status pesanan akan muncul di sini.</p>
          </div>
        ) : (
          items.map((n, idx) => (
            <div
              key={n.id}
              className={cn('cx-card rounded-3xl p-4 cx-rise', !n.read_at && n.user_id && 'border-zeger/30')}
              style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-zeger-soft flex items-center justify-center shrink-0">
                  <Bell className="h-[18px] w-[18px] text-zeger" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                  <p className="text-[11px] text-muted-foreground/70 mt-2">{relativeTime(n.created_at)}</p>
                </div>
                {!n.read_at && n.user_id && <span className="h-2 w-2 rounded-full bg-zeger mt-1.5 shrink-0" />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default CustomerNotifications;
