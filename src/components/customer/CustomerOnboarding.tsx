import { useRef, useState } from 'react';
import s1 from '@/assets/onboarding/onb-1.png.asset.json';
import s2 from '@/assets/onboarding/onb-2.png.asset.json';
import s3 from '@/assets/onboarding/onb-3.png.asset.json';

const SLIDES = [s1.url, s2.url, s3.url];
export const ONBOARDING_KEY = 'zeger_cx_onboarded_v1';

/** Three full-screen intro posters shown once on first open of the Customer app. */
export function CustomerOnboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const finish = () => { localStorage.setItem(ONBOARDING_KEY, '1'); onDone(); };
  const next = () => (i < SLIDES.length - 1 ? setI(i + 1) : finish());
  const prev = () => i > 0 && setI(i - 1);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-primary"
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (startX.current == null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx < -40) next(); else if (dx > 40) prev();
        startX.current = null;
      }}
    >
      <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {SLIDES.map((src, k) => (
          <img key={k} src={src} alt={`Zeger ${k + 1}`} className="h-full w-full shrink-0 object-cover" draggable={false} />
        ))}
      </div>
      <button onClick={finish} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full bg-background/80 px-4 py-1.5 text-sm font-semibold text-foreground backdrop-blur">
        Lewati
      </button>
      <div className="absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-4 px-6">
        <div className="flex gap-2">
          {SLIDES.map((_, k) => (
            <span key={k} className={`h-2 rounded-full bg-background transition-all ${k === i ? 'w-6' : 'w-2 opacity-60'}`} />
          ))}
        </div>
        <button onClick={next} className="btn-glossy-primary w-full max-w-sm rounded-full py-3 font-bold">
          {i === SLIDES.length - 1 ? 'Mulai' : 'Lanjut'}
        </button>
      </div>
    </div>
  );
}
