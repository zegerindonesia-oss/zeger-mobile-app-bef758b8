import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ZegerLogo } from '@/components/ui/zeger-logo';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

interface CustomerAuthProps {
  onAuthSuccess: () => void;
}

type AuthMode = 'login' | 'register' | 'complete-profile';

export function CustomerAuth({ onAuthSuccess }: CustomerAuthProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    address: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (error) throw error;

      if (data.user) {
        // Check if customer profile exists
        const { data: profile, error: profileError } = await supabase
          .from('customer_users')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          // No profile exists, need to complete registration
          setMode('complete-profile');
        } else if (profileError) {
          throw profileError;
        } else {
          onAuthSuccess();
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal login",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Password tidak cocok",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/customer`
        }
      });

      if (error) throw error;

      if (data.user) {
        setMode('complete-profile');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mendaftar",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('customer_users')
        .insert({
          user_id: user.id,
          email: formData.email || user.email,
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          role: 'customer',
          points: 0
        });

      if (error) throw error;

      toast({
        title: "Berhasil!",
        description: "Profil Anda berhasil dibuat",
      });

      onAuthSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal melengkapi profil",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderLogin = () => (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          placeholder="Masukkan email Anda"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="Masukkan password"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Loading...' : 'Masuk'}
      </Button>
      
      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{' '}
        <button
          type="button"
          onClick={() => setMode('register')}
          className="text-primary hover:underline"
        >
          Daftar di sini
        </button>
      </p>
    </form>
  );

  const renderRegister = () => (
    <form onSubmit={handleRegister} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          placeholder="Masukkan email Anda"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="Masukkan password"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          placeholder="Konfirmasi password"
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Loading...' : 'Daftar'}
      </Button>
      
      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{' '}
        <button
          type="button"
          onClick={() => setMode('login')}
          className="text-primary hover:underline"
        >
          Masuk di sini
        </button>
      </p>
    </form>
  );

  const renderCompleteProfile = () => (
    <form onSubmit={handleCompleteProfile} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nama Lengkap</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="Masukkan nama lengkap"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">Nomor Telepon</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          placeholder="Masukkan nomor telepon"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="address">Alamat</Label>
        <Input
          id="address"
          type="text"
          value={formData.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          placeholder="Masukkan alamat lengkap"
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Loading...' : 'Lengkapi Profil'}
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <ZegerLogo size="md" className="mx-auto" />
          <div>
            <h1 className="text-2xl font-bold text-primary">Zeger Coffee</h1>
            <p className="text-muted-foreground">
              {mode === 'login' && 'Masuk ke akun Anda'}
              {mode === 'register' && 'Buat akun baru'}
              {mode === 'complete-profile' && 'Lengkapi profil Anda'}
            </p>
          </div>
        </CardHeader>
        
        <CardContent>
          {mode === 'login' && renderLogin()}
          {mode === 'register' && renderRegister()}
          {mode === 'complete-profile' && renderCompleteProfile()}
        </CardContent>
      </Card>
    </div>
  );
}