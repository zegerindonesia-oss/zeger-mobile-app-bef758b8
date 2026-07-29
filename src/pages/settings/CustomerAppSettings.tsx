import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invalidateCustomerAppConfig } from '@/hooks/useCustomerAppConfig';

const FEATURE_KEYS = [
  ['loyalty', 'Zeger Loyalty'],
  ['subscription', 'Subscription'],
  ['vouchers', 'Voucher'],
  ['promo_reward', 'Promo & Reward'],
  ['referral', 'Referral'],
  ['care', 'Zeger Care'],
  ['notifications', 'Notifications'],
] as const;

const SECTION_KEYS = [
  ['membership', 'Kartu Membership'],
  ['voucher_referral', 'Kartu Voucher & Referral'],
  ['order_types', 'Tombol Order (Branch/Street/Wheels)'],
  ['rider_nearby', 'Rider di Sekitarmu'],
  ['promo_active', 'Promo Aktif'],
  ['big_order', 'Big Order Banner'],
  ['zeger_care', 'Zeger Care Banner'],
] as const;

export default function CustomerAppSettings() {
  const navigate = useNavigate();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [wa, setWa] = useState('');
  const [faq, setFaq] = useState<{ q: string; a: string }[]>([]);
  const [referralPoints, setReferralPoints] = useState(50);
  const [prefix, setPrefix] = useState('ZG-');
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = 'Customer App Settings | Zeger ERP'; load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('app_settings').select('setting_key, setting_value').eq('setting_type', 'customer_app');
    const map: Record<string, any> = {};
    (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value; });
    setFeatures(map['customer_features'] || {});
    setSections(map['customer_home.sections'] || {});
    setWa(typeof map['care.whatsapp_number'] === 'string' ? map['care.whatsapp_number'] : '');
    setFaq(Array.isArray(map['care.faq_items']) ? map['care.faq_items'] : []);
    setReferralPoints(typeof map['referral.reward_points'] === 'number' ? map['referral.reward_points'] : 50);
    setPrefix(typeof map['referral.code_prefix'] === 'string' ? map['referral.code_prefix'] : 'ZG-');
  };

  const upsert = async (key: string, value: any) => {
    const { error } = await supabase.from('app_settings').upsert({ setting_key: key, setting_value: value, setting_type: 'customer_app', is_active: true }, { onConflict: 'setting_key' });
    if (error) throw error;
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await upsert('customer_features', features);
      await upsert('customer_home.sections', sections);
      await upsert('care.whatsapp_number', wa);
      await upsert('care.faq_items', faq);
      await upsert('referral.reward_points', referralPoints);
      await upsert('referral.code_prefix', prefix);
      invalidateCustomerAppConfig();
      toast.success('Setting disimpan');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/app-management')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">Customer App Settings</h1>
        <Button onClick={saveAll} disabled={saving} className="ml-auto"><Save className="h-4 w-4 mr-1" />Simpan</Button>
      </div>

      <Tabs defaultValue="layout">
        <TabsList>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="care">Care</TabsTrigger>
          <TabsTrigger value="referral">Referral</TabsTrigger>
        </TabsList>

        <TabsContent value="layout">
          <Card><CardHeader><CardTitle>Section Home</CardTitle></CardHeader><CardContent className="space-y-3">
            {SECTION_KEYS.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={!!sections[k]} onCheckedChange={v => setSections(s => ({ ...s, [k]: v }))} />
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="features">
          <Card><CardHeader><CardTitle>Modul Customer App</CardTitle></CardHeader><CardContent className="space-y-3">
            {FEATURE_KEYS.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={!!features[k]} onCheckedChange={v => setFeatures(s => ({ ...s, [k]: v }))} />
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="care">
          <Card><CardHeader><CardTitle>Zeger Care</CardTitle></CardHeader><CardContent className="space-y-4">
            <div>
              <Label>Nomor WhatsApp (dengan kode negara, tanpa +)</Label>
              <Input value={wa} onChange={e => setWa(e.target.value)} placeholder="6281330886182" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><Label>FAQ</Label>
                <Button size="sm" variant="outline" onClick={() => setFaq([...faq, { q: '', a: '' }])}><Plus className="h-3 w-3 mr-1" />Tambah</Button>
              </div>
              {faq.map((item, i) => (
                <div key={i} className="border rounded-lg p-3 mb-2 space-y-2">
                  <Input placeholder="Pertanyaan" value={item.q} onChange={e => setFaq(f => f.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} />
                  <Input placeholder="Jawaban" value={item.a} onChange={e => setFaq(f => f.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} />
                  <Button size="sm" variant="ghost" onClick={() => setFaq(f => f.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 mr-1" />Hapus</Button>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="referral">
          <Card><CardHeader><CardTitle>Referral</CardTitle></CardHeader><CardContent className="space-y-4">
            <div><Label>Prefix kode</Label><Input value={prefix} onChange={e => setPrefix(e.target.value)} /></div>
            <div><Label>Poin bonus per referral</Label><Input type="number" value={referralPoints} onChange={e => setReferralPoints(parseInt(e.target.value) || 0)} /></div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}