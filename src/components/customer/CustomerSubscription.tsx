import { useEffect, useState } from 'react';
import { ChevronLeft, Package, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props { customerUser: any; onBack: () => void; }
interface Plan { id: string; name: string; description: string | null; price: number; quota: number; period_days: number; image_url: string | null; }
interface Sub { id: string; plan_id: string; status: string; ends_at: string; remaining_quota: number; plan?: Plan; }

export function CustomerSubscription({ customerUser, onBack }: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mySub, setMySub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('price'),
        supabase.from('customer_subscriptions').select('*, plan:plan_id(*)').eq('user_id', customerUser?.id).eq('status', 'active').gte('ends_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1),
      ]);
      setPlans((p as any) || []);
      setMySub(s && s.length ? (s[0] as any) : null);
      setLoading(false);
    })();
  }, [customerUser?.id]);

  const subscribe = async (plan: Plan) => {
    if (!confirm(`Berlangganan ${plan.name} — Rp ${plan.price.toLocaleString('id-ID')}?`)) return;
    const ends = new Date(); ends.setDate(ends.getDate() + plan.period_days);
    const { error } = await supabase.from('customer_subscriptions').insert({
      user_id: customerUser.id, plan_id: plan.id, status: 'active', ends_at: ends.toISOString(), remaining_quota: plan.quota,
    });
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Berhasil berlangganan', description: plan.name }); onBack(); }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="bg-[#EA2831] text-white p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10"><ChevronLeft className="h-6 w-6" /></button>
        <h1 className="text-xl font-bold">Subscription</h1>
      </div>
      <div className="p-4 space-y-4">
        {mySub && (
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-xs opacity-90">Paket Aktif</p>
            <p className="text-2xl font-bold">{mySub.plan?.name}</p>
            <p className="text-sm opacity-90 mt-1">Sisa {mySub.remaining_quota} kuota · s/d {new Date(mySub.ends_at).toLocaleDateString('id-ID')}</p>
          </div>
        )}
        {loading ? <p className="text-sm text-gray-500">Memuat...</p> :
          plans.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><Package className="h-12 w-12 mx-auto mb-2" /><p>Belum ada paket tersedia</p></div>
          ) : plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
              {plan.image_url && <img src={plan.image_url} alt={plan.name} className="w-full h-32 object-cover rounded-xl mb-3" />}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900">{plan.name}</p>
                  {plan.description && <p className="text-sm text-gray-600 mt-1">{plan.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-700">
                    <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-600" />{plan.quota} kuota</span>
                    <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-600" />{plan.period_days} hari</span>
                  </div>
                </div>
                <p className="text-xl font-bold text-[#EA2831] whitespace-nowrap">Rp {plan.price.toLocaleString('id-ID')}</p>
              </div>
              <Button onClick={() => subscribe(plan)} disabled={!!mySub} className="w-full mt-4 bg-[#EA2831] hover:bg-red-700">
                {mySub ? 'Sudah berlangganan' : 'Berlangganan'}
              </Button>
            </div>
          ))
        }
      </div>
    </div>
  );
}