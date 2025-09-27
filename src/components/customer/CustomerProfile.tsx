import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Star, 
  Edit, 
  Save, 
  X,
  LogOut,
  Settings,
  CreditCard,
  Bell,
  HelpCircle,
  Shield,
  FileText
} from 'lucide-react';

interface CustomerProfileProps {
  customerUser: any;
  onUpdateProfile: (user: any) => void;
}

export function CustomerProfile({ customerUser, onUpdateProfile }: CustomerProfileProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: customerUser?.name || '',
    phone: customerUser?.phone || '',
    address: customerUser?.address || ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_users')
        .update({
          name: formData.name,
          phone: formData.phone,
          address: formData.address
        })
        .eq('id', customerUser.id)
        .select()
        .single();

      if (error) throw error;

      onUpdateProfile(data);
      setIsEditing(false);
      toast({
        title: "Berhasil!",
        description: "Profil berhasil diperbarui",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal memperbarui profil",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Berhasil Logout",
        description: "Anda telah keluar dari akun",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal logout",
        variant: "destructive"
      });
    }
  };

  const getMembershipInfo = () => {
    const points = customerUser?.points || 0;
    if (points >= 1000) return { level: 'Gold', color: 'bg-yellow-500', nextLevel: null, pointsNeeded: 0 };
    if (points >= 500) return { level: 'Silver', color: 'bg-gray-400', nextLevel: 'Gold', pointsNeeded: 1000 - points };
    return { level: 'Bronze', color: 'bg-amber-600', nextLevel: 'Silver', pointsNeeded: 500 - points };
  };

  const membership = getMembershipInfo();

  return (
    <div className="space-y-6 p-4">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={customerUser?.photo_url} />
              <AvatarFallback className="text-lg">
                {customerUser?.name?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{customerUser?.name}</h3>
              <p className="text-muted-foreground">{customerUser?.email}</p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={`${membership.color} text-white`}>
                  {membership.level} Member
                </Badge>
                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>{customerUser?.points || 0} poin</span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Membership Progress */}
      {membership.nextLevel && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Menuju {membership.nextLevel}</span>
              <span className="text-xs text-muted-foreground">
                {membership.pointsNeeded} poin lagi
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ 
                  width: `${((customerUser?.points || 0) / (membership.nextLevel === 'Silver' ? 500 : 1000)) * 100}%` 
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Informasi Profile</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Nomor Telepon</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Alamat</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                />
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={loading}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Simpan
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: customerUser?.name || '',
                      phone: customerUser?.phone || '',
                      address: customerUser?.address || ''
                    });
                  }}
                  className="flex-1"
                >
                  Batal
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p>{customerUser?.email}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Nomor Telepon</p>
                  <p>{customerUser?.phone || 'Belum diisi'}</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Alamat</p>
                  <p>{customerUser?.address || 'Belum diisi'}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Menu Options */}
      <div className="space-y-2">
        {[
          { icon: CreditCard, label: 'Metode Pembayaran', action: () => {} },
          { icon: Bell, label: 'Notifikasi', action: () => {} },
          { icon: Settings, label: 'Pengaturan Akun', action: () => {} },
          { icon: HelpCircle, label: 'Pusat Bantuan', action: () => {} },
          { icon: Shield, label: 'Kebijakan Privasi', action: () => {} },
          { icon: FileText, label: 'Syarat & Ketentuan', action: () => {} },
        ].map(({ icon: Icon, label, action }) => (
          <Card key={label} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={action}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span>{label}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-auto p-0">
                  <span className="sr-only">Open</span>
                  →
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logout Button */}
      <Button 
        variant="destructive" 
        className="w-full"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Keluar
      </Button>
    </div>
  );
}