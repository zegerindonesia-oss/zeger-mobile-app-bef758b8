import { useEffect, useState } from 'react';
import { normalizeImageUrl } from '@/lib/image-url';
import { cn } from '@/lib/utils';
import zegerPromo from '@/assets/flow/zeger-promo.png.asset.json';

interface Props {
  src?: string | null;
  title?: string | null;
  className?: string;
  /** Rendered in place of a broken image so a missing upload still looks finished. */
  captionOnFallback?: boolean;
}

/**
 * Promo artwork that degrades gracefully: uploaded image → Zeger house banner →
 * branded gradient. It never shows a broken-image icon or raw alt text.
 */
export function CxPromoImage({ src, title, className, captionOnFallback = true }: Props) {
  const primary = normalizeImageUrl(src || '') || zegerPromo.url;
  const [current, setCurrent] = useState(primary);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrent(primary);
    setFailed(false);
  }, [primary]);

  return (
    <div className={cn('relative overflow-hidden bg-gradient-to-br from-zeger-dark via-zeger to-zeger-dark', className)}>
      <span className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      {failed && captionOnFallback && (
        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">Zeger Coffee</span>
          {title && <span className="mt-1 text-sm font-extrabold leading-snug text-white">{title}</span>}
        </span>
      )}
      {!failed && (
        <img
          src={current}
          alt=""
          aria-hidden
          loading="lazy"
          onError={() => (current === zegerPromo.url ? setFailed(true) : setCurrent(zegerPromo.url))}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export default CxPromoImage;
