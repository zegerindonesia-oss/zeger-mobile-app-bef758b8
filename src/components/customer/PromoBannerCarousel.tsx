import React, { useState, useEffect } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { cn } from '@/lib/utils';

export function PromoBannerCarousel() {
  const [api, setApi] = useState<any>();
  const [current, setCurrent] = useState(0);

  const banners = [
    '/promo-banners/octobrew-1.png',
    '/promo-banners/octobrew-2.png',
    '/promo-banners/octobrew-3.png',
    '/promo-banners/octobrew-4.png'
  ];

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
          {banners.map((banner, index) => (
            <CarouselItem key={index}>
              <div className="relative w-full h-48 bg-gradient-to-br from-red-500 to-red-600">
                <img
                  src={banner}
                  alt={`Promo Banner ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop';
                  }}
                />
              </div>
            </CarouselItem>
          ))}
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
