import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Gift, Lock, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerPromoRewardProps {
  customerUser: any;
  onNavigate: (view: string) => void;
}

interface RewardItem {
  id: string;
  name: string;
  image_url: string;
  points_required: number;
  category: string;
  description: string;
}

interface Promo {
  id: string;
  title: string;
  image_url: string;
  category: string;
  valid_until: string;
  description: string;
}

export function CustomerPromoReward({ customerUser, onNavigate }: CustomerPromoRewardProps) {
  const [rewardItems, setRewardItems] = useState<RewardItem[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [activeCategory, setActiveCategory] = useState('Semua');
  
  const categories = ['Semua', 'Espresso Based', 'Milk Based', 'Refresher', 'Botol'];

  useEffect(() => {
    fetchRewardItems();
    fetchPromos();
  }, []);

  const fetchRewardItems = async () => {
    // Fetch dari database - untuk sementara kosong, akan tampilkan placeholder
  };

  const fetchPromos = async () => {
    // Mock data dengan category - temporary solution
    const mockPromos: Promo[] = [
      { 
        id: '1',
        title: 'Seni Datang, Perut Tenang',
        category: 'Espresso Based',
        image_url: '/promo-banners/octobrew-1.png',
        valid_until: '2025-12-31',
        description: 'Nikmati kopi sambil menikmati seni'
      },
      { 
        id: '2',
        title: 'Promo Spesial Oktober',
        category: 'Milk Based',
        image_url: '/promo-banners/octobrew-2.png',
        valid_until: '2025-11-30',
        description: 'Promo spesial bulan ini'
      },
      { 
        id: '3',
        title: 'Diskon 50% All Menu',
        category: 'Refresher',
        image_url: '/promo-banners/octobrew-3.png',
        valid_until: '2025-11-30',
        description: 'Diskon besar-besaran'
      },
      { 
        id: '4',
        title: 'Beli 2 Gratis 1',
        category: 'Botol 1 Liter',
        image_url: '/promo-banners/octobrew-4.png',
        valid_until: '2025-11-30',
        description: 'Promo botol spesial'
      }
    ];
    setPromos(mockPromos);
  };

  const filteredPromos = activeCategory === 'Semua' 
    ? promos 
    : promos.filter(p => {
        if (activeCategory === 'Botol') {
          return p.category === 'Botol 1 Liter' || p.category === 'Botol 200ml';
        }
        return p.category === activeCategory;
      });

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="bg-white p-4 border-b sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900">Promo & Reward</h1>
      </div>

      {/* Reward Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Reward</h2>
          <button 
            className="text-sm text-[#EA2831] flex items-center gap-1"
            onClick={() => onNavigate('vouchers')}
          >
            Lihat semua <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Horizontal Scroll Reward Cards */}
        <ScrollArea className="w-full whitespace-nowrap rounded-md">
          <div className="flex gap-4 pb-4">
            {/* Placeholder cards */}
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="flex-shrink-0 w-44 p-4 text-center shadow-md hover:shadow-xl transition-shadow">
                <div className="w-24 h-24 mx-auto mb-3 rounded-full bg-gradient-to-br from-red-100 to-yellow-100 flex items-center justify-center">
                  <span className="text-4xl">
                    {i === 0 ? '🍦' : i === 1 ? '💧' : '☕'}
                  </span>
                </div>
                <div className="bg-gray-200 rounded-full px-3 py-1 inline-flex items-center gap-1 mb-2">
                  <Lock className="h-3 w-3 text-gray-600" />
                  <span className="text-sm font-semibold text-gray-700">
                    {i === 0 ? '15' : i === 1 ? '20' : '10'} poin
                  </span>
                </div>
                <p className="font-semibold text-sm text-gray-900">
                  {i === 0 ? 'Ice Cream Cone' : i === 1 ? 'Prim-A 600ml' : 'Espresso Shot'}
                </p>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {/* Manjakan Dirimu Banner */}
        <Card className="mt-6 bg-gradient-to-r from-purple-600 to-orange-500 text-white p-6 shadow-xl">
          <h3 className="text-xl font-bold mb-2">Manjakan dirimu</h3>
          <p className="text-sm opacity-90">
            Nikmati lebih banyak cara untuk mendapatkan poin dan mendapatkan produk yang Anda sukai.
          </p>
          <div className="mt-4">
            <span className="text-4xl font-bold">Double Point</span>
          </div>
        </Card>
      </div>

      {/* Promo Section */}
      <div className="p-4 pt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Promo</h2>

        {/* Category Filter Pills */}
        <ScrollArea className="w-full whitespace-nowrap mb-4">
          <div className="flex gap-2 pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-medium transition-all flex-shrink-0 border-2",
                  activeCategory === cat
                    ? "bg-[#EA2831] border-[#EA2831] text-white shadow-[0_4px_12px_rgba(234,40,49,0.4)]"
                    : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Promo Cards - Horizontal Scroll */}
        <ScrollArea className="w-full whitespace-nowrap rounded-md">
          <div className="flex gap-4 pb-4">
            {filteredPromos.length === 0 ? (
              <Card className="flex-shrink-0 w-80 p-8 text-center">
                <p className="text-gray-500 whitespace-normal">Tidak ada promo untuk kategori ini</p>
              </Card>
            ) : (
              filteredPromos.map((promo) => (
                <Card 
                  key={promo.id} 
                  className="flex-shrink-0 w-80 overflow-hidden shadow-lg rounded-2xl hover:shadow-2xl transition-shadow"
                >
                  <div className="relative">
                    <img 
                      src={promo.image_url}
                      alt={promo.title}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                    <Badge className="absolute top-3 left-3 bg-[#EA2831] text-white flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Segera habis masa berlakunya
                    </Badge>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-gray-900 whitespace-normal">{promo.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 whitespace-normal">{promo.description}</p>
                    <Badge variant="outline" className="mt-2">{promo.category}</Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
