import React, { useState, useEffect } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export function PromoBannerCarousel() {
  const [api, setApi] = useState<any>();
  const [current, setCurrent] = useState(0);
  const [banners, setBanners] = useState<Array<{ id: string; title: string; image_url: string; link_url: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  // Fetch banners from database
  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('promo_banners')
        .select('id, title, image_url, link_url')
        .eq('is_active', true)
        .gte('valid_until', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
        .order('display_order');
      
      if (error) throw error;
      
      // Fallback to static banners if no data
      if (!data || data.length === 0) {
        setBanners([
          { id: '1', title: 'Promo 1', image_url: '/promo-banners/octobrew-1.png', link_url: null },
          { id: '2', title: 'Promo 2', image_url: '/promo-banners/octobrew-2.png', link_url: null },
          { id: '3', title: 'Promo 3', image_url: '/promo-banners/octobrew-3.png', link_url: null },
          { id: '4', title: 'Promo 4', image_url: '/promo-banners/octobrew-4.png', link_url: null }
        ]);
      } else {
        setBanners(data);
      }
    } catch (error) {
      console.error('Error fetching banners:', error);
      // Fallback to static banners on error
      setBanners([
        { id: '1', title: 'Promo 1', image_url: '/promo-banners/octobrew-1.png', link_url: null },
        { id: '2', title: 'Promo 2', image_url: '/promo-banners/octobrew-2.png', link_url: null },
        { id: '3', title: 'Promo 3', image_url: '/promo-banners/octobrew-3.png', link_url: null },
        { id: '4', title: 'Promo 4', image_url: '/promo-banners/octobrew-4.png', link_url: null }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());

    api.on('select', () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <div className="w-full overflow-hidden">
      <Carousel
        setApi={setApi}
        className="w-full"
        plugins={[
          Autoplay({
            delay: 3000,
          }),
        ]}
        opts={{
          loop: true,
        }}
      >
        <CarouselContent>
          {loading ? (
            <CarouselItem>
              <div className="relative w-full h-64 bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <p className="text-white">Loading...</p>
              </div>
            </CarouselItem>
          ) : (
            banners.map((banner) => (
              <CarouselItem key={banner.id}>
                <div className="relative w-full h-64 bg-gradient-to-br from-red-500 to-red-600">
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop';
                    }}
                  />
                </div>
              </CarouselItem>
            ))
          )}
        </CarouselContent>

        {/* Dots Indicator */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                current === index 
                  ? "bg-white w-8" 
                  : "bg-white/50 hover:bg-white/75"
              )}
            />
          ))}
        </div>
      </Carousel>
    </div>
  );
}

export default PromoBannerCarousel;
