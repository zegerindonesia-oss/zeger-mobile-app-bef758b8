import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Award, Plus, Pencil, ArrowLeft, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface LoyaltyTier {
  id: string;
  tier_name: string;
  min_points: number;
  discount_percentage: number;
  benefits: any;
  tier_color: string;
}

interface LoyaltyReward {
  id: string;
  reward_name: string;
  description: string | null;
  points_required: number;
  reward_type: string;
  reward_value: any;
  image_url: string | null;
  is_active: boolean;
  stock_quantity: number | null;
}

export default function LoyaltyManagement() {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);

  const [tierForm, setTierForm] = useState({
    tier_name: '',
    min_points: 0,
    discount_percentage: 0,
    tier_color: '#CD7F32',
    benefits: ''
  });

  const [rewardForm, setRewardForm] = useState({
    reward_name: '',
    description: '',
    points_required: 0,
    reward_type: 'discount',
    reward_value: '',
    image_url: '',
    is_active: true,
    stock_quantity: null as number | null
  });

  useEffect(() => {
    document.title = 'Loyalty Management | Zeger ERP';
    fetchTiers();
    fetchRewards();
    fetchEarnSettings();
  }, []);

  const fetchEarnSettings = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'loyalty.earning')
        .maybeSingle();
      const v: any = data?.setting_value || {};
      setEarnForm({
        enabled: v.enabled ?? true,
        rupiah_per_point: Number(v.rupiah_per_point ?? 10000),
        min_transaction: Number(v.min_transaction ?? 0),
      });
    } catch {
      /* keep defaults */
    }
  };

  const saveEarnSettings = async () => {
    if (!earnForm.rupiah_per_point || earnForm.rupiah_per_point <= 0) {
      toast.error('Nilai rupiah per poin harus lebih dari 0');
      return;
    }
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('setting_key', 'loyalty.earning')
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('app_settings')
          .update({ setting_value: earnForm as any, is_active: true })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('app_settings').insert({
          setting_key: 'loyalty.earning',
          setting_value: earnForm as any,
          setting_type: 'loyalty',
          description: 'Pengaturan perolehan poin loyalty',
          is_active: true,
        });
        if (error) throw error;
      }
      toast.success('Pengaturan poin tersimpan');
    } catch (e: any) {
      toast.error('Gagal menyimpan: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .order('min_points');
      
      if (error) throw error;
      setTiers(data || []);
    } catch (error: any) {
      toast.error('Gagal memuat tier: ' + error.message);
    }
  };

  const fetchRewards = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .order('points_required');
      
      if (error) throw error;
      setRewards(data || []);
    } catch (error: any) {
      toast.error('Gagal memuat rewards: ' + error.message);
    }
  };

  const handleTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tierData = {
        ...tierForm,
        benefits: tierForm.benefits ? JSON.parse(tierForm.benefits) : {}
      };

      if (editingTier) {
        const { error } = await supabase
          .from('loyalty_tiers')
          .update(tierData)
          .eq('id', editingTier.id);

        if (error) throw error;
        toast.success('Tier berhasil diupdate');
      } else {
        const { error } = await supabase
          .from('loyalty_tiers')
          .insert(tierData);

        if (error) throw error;
        toast.success('Tier berhasil ditambahkan');
      }

      setTierDialogOpen(false);
      resetTierForm();
      fetchTiers();
    } catch (error: any) {
      toast.error('Gagal menyimpan tier: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRewardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const rewardData = {
        ...rewardForm,
        reward_value: rewardForm.reward_value ? JSON.parse(rewardForm.reward_value) : {}
      };

      if (editingReward) {
        const { error } = await supabase
          .from('loyalty_rewards')
          .update(rewardData)
          .eq('id', editingReward.id);

        if (error) throw error;
        toast.success('Reward berhasil diupdate');
      } else {
        const { error } = await supabase
          .from('loyalty_rewards')
          .insert(rewardData);

        if (error) throw error;
        toast.success('Reward berhasil ditambahkan');
      }

      setRewardDialogOpen(false);
      resetRewardForm();
      fetchRewards();
    } catch (error: any) {
      toast.error('Gagal menyimpan reward: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTier = (tier: LoyaltyTier) => {
    setEditingTier(tier);
    setTierForm({
      tier_name: tier.tier_name,
      min_points: tier.min_points,
      discount_percentage: tier.discount_percentage,
      tier_color: tier.tier_color,
      benefits: JSON.stringify(tier.benefits, null, 2)
    });
    setTierDialogOpen(true);
  };

  const handleEditReward = (reward: LoyaltyReward) => {
    setEditingReward(reward);
    setRewardForm({
      reward_name: reward.reward_name,
      description: reward.description || '',
      points_required: reward.points_required,
      reward_type: reward.reward_type,
      reward_value: JSON.stringify(reward.reward_value, null, 2),
      image_url: reward.image_url || '',
      is_active: reward.is_active,
      stock_quantity: reward.stock_quantity
    });
    setRewardDialogOpen(true);
  };

  const resetTierForm = () => {
    setTierForm({
      tier_name: '',
      min_points: 0,
      discount_percentage: 0,
      tier_color: '#CD7F32',
      benefits: ''
    });
    setEditingTier(null);
  };

  const resetRewardForm = () => {
    setRewardForm({
      reward_name: '',
      description: '',
      points_required: 0,
      reward_type: 'discount',
      reward_value: '',
      image_url: '',
      is_active: true,
      stock_quantity: null
    });
    setEditingReward(null);
  };

  return (
    <main className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings/app-management')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6" />
            Loyalty Management
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Kelola tier loyalty dan reward points
        </p>
      </header>

      <Tabs defaultValue="tiers" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">Pengaturan Poin</TabsTrigger>
          <TabsTrigger value="tiers">Loyalty Tiers</TabsTrigger>
          <TabsTrigger value="rewards">Rewards Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Perolehan Poin (semua channel)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Aktifkan poin loyalty</Label>
                  <p className="text-xs text-muted-foreground">
                    Berlaku untuk app customer, rider (on the wheels/street), dan kasir outlet.
                  </p>
                </div>
                <Switch
                  checked={earnForm.enabled}
                  onCheckedChange={(v) => setEarnForm({ ...earnForm, enabled: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nilai Rupiah untuk 1 Poin</Label>
                <Input
                  type="number"
                  min={1}
                  value={earnForm.rupiah_per_point}
                  onChange={(e) => setEarnForm({ ...earnForm, rupiah_per_point: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Contoh: 10000 berarti setiap belanja Rp10.000 dapat 1 poin.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Minimal Transaksi Dapat Poin (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  value={earnForm.min_transaction}
                  onChange={(e) => setEarnForm({ ...earnForm, min_transaction: Number(e.target.value) })}
                />
              </div>
              <Button onClick={saveEarnSettings} disabled={loading}>Simpan Pengaturan</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={tierDialogOpen} onOpenChange={(open) => {
              setTierDialogOpen(open);
              if (!open) resetTierForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Tier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingTier ? 'Edit Tier' : 'Tambah Tier Baru'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleTierSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nama Tier</Label>
                    <Input
                      value={tierForm.tier_name}
                      onChange={(e) => setTierForm({ ...tierForm, tier_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimal Points</Label>
                    <Input
                      type="number"
                      value={tierForm.min_points}
                      onChange={(e) => setTierForm({ ...tierForm, min_points: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Diskon (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tierForm.discount_percentage}
                      onChange={(e) => setTierForm({ ...tierForm, discount_percentage: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Warna Tier</Label>
                    <Input
                      type="color"
                      value={tierForm.tier_color}
                      onChange={(e) => setTierForm({ ...tierForm, tier_color: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Benefits (JSON)</Label>
                    <Textarea
                      value={tierForm.benefits}
                      onChange={(e) => setTierForm({ ...tierForm, benefits: e.target.value })}
                      placeholder='{"description": "Benefits description", "free_delivery": true}'
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setTierDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <Card key={tier.id} className="border-2" style={{ borderColor: tier.tier_color }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tier.tier_color }} />
                      <CardTitle>{tier.tier_name}</CardTitle>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleEditTier(tier)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm"><strong>Min Points:</strong> {tier.min_points}</p>
                  <p className="text-sm"><strong>Diskon:</strong> {tier.discount_percentage}%</p>
                  {tier.benefits?.description && (
                    <p className="text-xs text-muted-foreground">{tier.benefits.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={rewardDialogOpen} onOpenChange={(open) => {
              setRewardDialogOpen(open);
              if (!open) resetRewardForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Reward
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingReward ? 'Edit Reward' : 'Tambah Reward Baru'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleRewardSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nama Reward</Label>
                    <Input
                      value={rewardForm.reward_name}
                      onChange={(e) => setRewardForm({ ...rewardForm, reward_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deskripsi</Label>
                    <Input
                      value={rewardForm.description}
                      onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Points Required</Label>
                      <Input
                        type="number"
                        value={rewardForm.points_required}
                        onChange={(e) => setRewardForm({ ...rewardForm, points_required: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stock (Optional)</Label>
                      <Input
                        type="number"
                        value={rewardForm.stock_quantity || ''}
                        onChange={(e) => setRewardForm({ ...rewardForm, stock_quantity: e.target.value ? parseInt(e.target.value) : null })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Reward Value (JSON)</Label>
                    <Textarea
                      value={rewardForm.reward_value}
                      onChange={(e) => setRewardForm({ ...rewardForm, reward_value: e.target.value })}
                      placeholder='{"discount": 20000} or {"product_id": "xxx"}'
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gambar Reward</Label>
                    <ImageUpload
                      value={rewardForm.image_url}
                      onChange={(url) => setRewardForm({ ...rewardForm, image_url: url })}
                      bucket="loyalty-images"
                      label="Gambar Reward"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={rewardForm.is_active}
                      onCheckedChange={(checked) => setRewardForm({ ...rewardForm, is_active: checked })}
                    />
                    <Label>Aktif</Label>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setRewardDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rewards.map((reward) => (
              <Card key={reward.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5" />
                      <CardTitle className="text-base">{reward.reward_name}</CardTitle>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleEditReward(reward)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {reward.image_url && (
                    <img src={reward.image_url} alt={reward.reward_name} className="w-full h-32 object-cover rounded" />
                  )}
                  <p className="text-sm">{reward.description}</p>
                  <p className="text-sm font-bold text-primary">{reward.points_required} Points</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${reward.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                      {reward.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                    {reward.stock_quantity && (
                      <span className="text-xs text-muted-foreground">Stock: {reward.stock_quantity}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
