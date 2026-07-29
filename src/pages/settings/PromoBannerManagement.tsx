import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Image, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  display_order: number;
  valid_from: string | null;
  valid_until: string | null;
  placement?: string;
}

export default function PromoBannerManagement() {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    link_url: '',
    is_active: true,
    display_order: 0,
    valid_from: '',
    valid_until: '',
    placement: 'carousel'
  });

  useEffect(() => {
    document.title = 'Promo Banner Management | Zeger ERP';
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promo_banners')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      setBanners(data || []);
    } catch (error: any) {
      toast.error('Gagal memuat banner: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (editingBanner) {
        const { error } = await supabase
          .from('promo_banners')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingBanner.id);

        if (error) throw error;
        toast.success('Banner berhasil diupdate');
      } else {
        const { error } = await supabase
          .from('promo_banners')
          .insert({
            ...formData,
            created_by: profile?.id
          });

        if (error) throw error;
        toast.success('Banner berhasil ditambahkan');
      }

      setDialogOpen(false);
      resetForm();
      fetchBanners();
    } catch (error: any) {
      toast.error('Gagal menyimpan banner: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus banner ini?')) return;

    try {
      const { error } = await supabase
        .from('promo_banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Banner berhasil dihapus');
      fetchBanners();
    } catch (error: any) {
      toast.error('Gagal menghapus banner: ' + error.message);
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description || '',
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      is_active: banner.is_active,
      display_order: banner.display_order,
      valid_from: banner.valid_from || '',
      valid_until: banner.valid_until || '',
      placement: (banner as any).placement || 'carousel'
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      link_url: '',
      is_active: true,
      display_order: 0,
      valid_from: '',
      valid_until: '',
      placement: 'carousel'
    });
    setEditingBanner(null);
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      const { error } = await supabase
        .from('promo_banners')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;
      toast.success(`Banner ${!banner.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchBanners();
    } catch (error: any) {
      toast.error('Gagal mengubah status banner: ' + error.message);
    }
  };

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings/app-management')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Image className="w-6 h-6" />
              Promo Banner Management
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Kelola banner promosi yang ditampilkan di aplikasi customer
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Tambah Banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingBanner ? 'Edit Banner' : 'Tambah Banner Baru'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Judul Banner</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Gambar Banner</Label>
                <ImageUpload
                  value={formData.image_url}
                  onChange={(url) => setFormData({ ...formData, image_url: url })}
                  bucket="banner-images"
                  label="Gambar Banner"
                  aspect="banner"
                />
                <p className="text-xs text-muted-foreground">
                  Rekomendasi ukuran: Carousel Home 1200×675 (16:9) · Big Order & Zeger Care 1200×525 (16:7)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Lokasi Tampil (Placement)</Label>
                <Select
                  value={formData.placement}
                  onValueChange={(v) => setFormData({ ...formData, placement: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carousel">Home Carousel (Hero Atas)</SelectItem>
                    <SelectItem value="big_order">Big Order (Section Home)</SelectItem>
                    <SelectItem value="zeger_care">Zeger Care (Section Home)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Link URL (Optional)</Label>
                <Input
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Urutan Tampil</Label>
                  <Input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Aktif</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Berlaku Dari</Label>
                  <Input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Berlaku Sampai</Label>
                  <Input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {loading && banners.length === 0 ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((banner) => (
            <Card key={banner.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{banner.title}</CardTitle>
                    {banner.description && (
                      <p className="text-sm text-muted-foreground">{banner.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(banner)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(banner.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <img src={banner.image_url} alt={banner.title} className="w-full h-40 object-cover rounded" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Order: {banner.display_order}</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={() => handleToggleActive(banner)}
                    />
                    <span className="text-sm">{banner.is_active ? 'Aktif' : 'Nonaktif'}</span>
                  </div>
                </div>
                {banner.valid_until && (
                  <p className="text-xs text-muted-foreground">
                    Berlaku sampai: {new Date(banner.valid_until).toLocaleDateString('id-ID')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
