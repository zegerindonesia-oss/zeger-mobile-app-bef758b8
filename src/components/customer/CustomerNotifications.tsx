import { useEffect, useState } from 'react';
import { ChevronLeft, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props { customerUser: any; onBack: () => void; }
interface Notif { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string; user_id: string | null; }

export function CustomerNotifications({ customerUser, onBack }: Props) {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('customer_notifications')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${customerUser?.id}`)
        .order('created_at', { ascending: false })
        .limit(100);
      setItems((data as any) || []);
      setLoading(false);
      // mark personal as read
      const unread = (data || []).filter((n: any) => n.user_id === customerUser?.id && !n.read_at).map((n: any) => n.id);
      if (unread.length) await supabase.from('customer_notifications').update({ read_at: new Date().toISOString() }).in('id', unread);
    })();
  }, [customerUser?.id]);

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="bg-[#EA2831] text-white p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10"><ChevronLeft className="h-6 w-6" /></button>
        <h1 className="text-xl font-bold">Notifikasi</h1>
      </div>
      <div className="p-4 space-y-3">
        {loading ? <p className="text-sm text-gray-500">Memuat...</p> :
          items.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><Bell className="h-12 w-12 mx-auto mb-2" /><p>Belum ada notifikasi</p></div>
          ) : items.map(n => (
            <div key={n.id} className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><Bell className="h-5 w-5 text-[#EA2831]" /></div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{n.title}</p>
                  {n.body && <p className="text-sm text-gray-600 mt-1">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleString('id-ID')}</p>
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}