import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import {
  User, Mail, Phone, MapPin, Edit3, Save, X, LogOut, Bell, HelpCircle, Shield, FileText,
  Ticket, Crown, Gift, ChevronRight, ShoppingBag, Sparkles,
} from 'lucide-react';
import { cxArt } from '@/lib/customer-art';
import { cn } from '@/lib/utils';

interface CustomerProfileProps {
  customerUser: any;
  onUpdateProfile: (user: any) => void;
  onNavigate?: (view: string) => void;
}

const tierFor = (points: number) => {
  if (points >= 1000) return { level: 'Gold', next: null as string | null, target: 1000, from: 1000 };
  if (points >= 500) return { level: 'Silver', next: 'Gold', target: 1000, from: 500 };
  return { level: 'Bronze', next: 'Silver', target: 500, from: 0 };
};

export function CustomerProfile({ customerUser, onUpdateProfile, onNavigate }: CustomerProfileProps) {
  const { toast } = useToast();
  const cfg = useCustomerAppConfig();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: customerUser?.name || '',
    phone: customerUser?.phone || '',
    address: customerUser?.address || '',
  });

  const points = customerUser?.points || 0;
  const tier = tierFor(points);
  const progress = tier.next
    ? Math.min(100, Math.max(0, ((points - tier.from) / (tier.target - tier.from)) * 100))
    : 100;

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Nama wajib diisi', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_users')
        .update({ name: formData.name, phone: formData.phone, address: formData.address })
        .eq('id', customerUser.id)
        .select()
        .single();
      if (error) throw error;
      onUpdateProfile(data);
      setIsEditing(false);
      toast({ title: 'Tersimpan', description: 'Profil berhasil diperbarui.' });
    } catch (error: any) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({ title: 'Sampai jumpa!', description: 'Kamu sudah keluar dari akun.' });
    } catch (error: any) {
      toast({ title: 'Gagal keluar', description: error.message, variant: 'destructive' });
    }
  };

  const shortcuts = [
    { icon: ShoppingBag, label: 'Pesanan', view: 'orders', show: true },
    { icon: Ticket, label: 'Voucher', view: 'vouchers', show: cfg.features.vouchers },
    { icon: Sparkles, label: 'Poin', view: 'loyalty', show: cfg.features.loyalty },
    { icon: Crown, label: 'MyZeger', view: 'subscription', show: cfg.features.subscription },
  ].filter((s) => s.show);

  const menu = [
    { icon: Gift, label: 'Ajak Teman', hint: `+${cfg.referral.reward_points} poin`, view: 'referral', show: cfg.features.referral },
    { icon: Bell, label: 'Notifikasi', view: 'notifications', show: cfg.features.notifications },
    { icon: HelpCircle, label: 'Zeger Care', view: 'care', show: cfg.features.care },
  ].filter((m) => m.show);

  const legal = [
    { icon: Shield, label: 'Kebijakan Privasi' },
    { icon: FileText, label: 'Syarat & Ketentuan' },
  ];

  const wa = (cfg.care.whatsapp_number || '').replace(/\D/g, '');

  return (
    <div className="cx-app min-h-screen pb-32">
      {/* Hero */}
      <div className="cx-stage-dark relative px-5 pt-8 pb-16 text-white overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 bottom-[-3rem] h-36 w-36 rounded-full bg-white/[0.07] blur-2xl"
        />
        <div className="flex items-center gap-4 relative">
          <div className="h-16 w-16 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 flex items-center justify-center overflow-hidden shrink-0">
            {customerUser?.photo_url ? (
              <img src={customerUser.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-extrabold">{(customerUser?.name || 'Z').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold truncate">{customerUser?.name || 'Zeger Lovers'}</h1>
            <p className="text-xs opacity-85 truncate">{customerUser?.email}</p>
            <span className="inline-flex items-center gap-1 mt-1.5 rounded-full bg-white/18 border border-white/25 px-2.5 py-0.5 text-[11px] font-bold">
              <Crown className="h-3 w-3" /> {tier.level} Member
            </span>
          </div>
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="h-10 w-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center shrink-0"
            aria-label="Ubah profil"
          >
            {isEditing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="px-4 -mt-10 space-y-4 relative">
        {/* Points card */}
        <div className="cx-card cx-sheen rounded-3xl p-4 cx-rise">
          <div className="flex items-center gap-3">
            <img src={cxArt.coin} alt="" className="cx-coin cx-coin-spin h-11 w-11 object-contain shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="cx-num text-xl font-extrabold leading-none">{points.toLocaleString('id-ID')}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Zeger Point • berlaku di semua channel</p>
            </div>
            {cfg.features.loyalty && (
              <button onClick={() => onNavigate?.('loyalty')} className="cx-btn cx-btn-ghost px-4 py-2 text-xs shrink-0">
                Tukar
              </button>
            )}
          </div>
          {tier.next && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-[hsl(var(--cx-rail))] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-zeger to-zeger-dark transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {Math.max(0, tier.target - points)} poin lagi menuju <span className="font-bold text-zeger">{tier.next}</span>
              </p>
            </div>
          )}
        </div>

        {/* Shortcuts */}
        {onNavigate && shortcuts.length > 0 && (
          <div className="cx-card rounded-3xl p-3 grid grid-cols-4 gap-1">
            {shortcuts.map((s) => (
              <button
                key={s.view}
                onClick={() => onNavigate(s.view)}
                className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl active:scale-95 transition-transform"
              >
                <span className="h-11 w-11 rounded-2xl bg-zeger-soft flex items-center justify-center">
                  <s.icon className="h-[18px] w-[18px] text-zeger" />
                </span>
                <span className="text-[11px] font-semibold">{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Profile info / edit */}
        <div className="cx-card rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-[18px] w-[18px] text-zeger" />
            <h2 className="text-base font-bold">Informasi Akun</h2>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <Field label="Nama Lengkap" value={formData.name} onChange={(v) => setFormData((p) => ({ ...p, name: v }))} />
              <Field label="Nomor Telepon" value={formData.phone} onChange={(v) => setFormData((p) => ({ ...p, phone: v }))} type="tel" />
              <Field label="Alamat" value={formData.address} onChange={(v) => setFormData((p) => ({ ...p, address: v }))} />
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveProfile} disabled={loading} className="cx-btn cx-btn-primary flex-1 px-4 py-3 text-sm inline-flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" /> {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({ name: customerUser?.name || '', phone: customerUser?.phone || '', address: customerUser?.address || '' });
                  }}
                  className="cx-btn cx-btn-ghost flex-1 px-4 py-3 text-sm"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <InfoRow icon={Mail} label="Email" value={customerUser?.email} />
              <InfoRow icon={Phone} label="Nomor Telepon" value={customerUser?.phone} />
              <InfoRow icon={MapPin} label="Alamat" value={customerUser?.address} />
            </div>
          )}
        </div>

        {/* Menu */}
        {(onNavigate && menu.length > 0) && (
          <div className="cx-card rounded-3xl overflow-hidden">
            {menu.map((m, i) => (
              <button
                key={m.label}
                onClick={() => onNavigate(m.view)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[hsl(var(--cx-rail))] transition-colors',
                  i > 0 && 'border-t border-[hsl(var(--cx-line))]'
                )}
              >
                <span className="h-9 w-9 rounded-xl bg-zeger-soft flex items-center justify-center shrink-0">
                  <m.icon className="h-4 w-4 text-zeger" />
                </span>
                <span className="flex-1 text-sm font-semibold">{m.label}</span>
                {m.hint && <span className="text-[11px] font-bold text-zeger">{m.hint}</span>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Legal */}
        <div className="cx-card rounded-3xl overflow-hidden">
          {legal.map((m, i) => (
            <button
              key={m.label}
              onClick={() => wa && window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`Halo Zeger, saya ingin menanyakan ${m.label}.`)}`, '_blank')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[hsl(var(--cx-rail))] transition-colors',
                i > 0 && 'border-t border-[hsl(var(--cx-line))]'
              )}
            >
              <span className="h-9 w-9 rounded-xl bg-[hsl(var(--cx-rail))] flex items-center justify-center shrink-0">
                <m.icon className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="flex-1 text-sm font-semibold">{m.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <button onClick={handleLogout} className="cx-btn cx-btn-ghost w-full px-5 py-3.5 text-sm inline-flex items-center justify-center gap-2">
          <LogOut className="h-4 w-4" /> Keluar
        </button>

        <p className="text-center text-[11px] text-muted-foreground pt-1">Zeger Coffee • versi aplikasi 2.0</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-[hsl(var(--cx-line))] bg-white px-4 py-3 text-sm outline-none focus:border-zeger/50 focus:ring-4 focus:ring-zeger/10"
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <span className="h-9 w-9 rounded-xl bg-[hsl(var(--cx-rail))] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold break-words">{value || 'Belum diisi'}</p>
      </div>
    </div>
  );
}

export default CustomerProfile;
