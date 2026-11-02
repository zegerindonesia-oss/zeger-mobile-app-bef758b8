// Converts Google Drive share links into direct image URLs so photos render everywhere.
export const normalizeImageUrl = (raw?: string | null): string | null => {
  const url = String(raw ?? '').trim();
  if (!url) return null;
  if (/drive\.google\.com|docs\.google\.com/.test(url)) {
    const id = url.match(/\/d\/([\w-]{10,})/)?.[1] || url.match(/[?&]id=([\w-]{10,})/)?.[1];
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  }
  return url;
};

// Small compressed thumbnail for grids (keeps POS scrolling light).
export const thumbImageUrl = (raw?: string | null, size = 240): string | null => {
  const url = normalizeImageUrl(raw);
  if (!url) return null;
  if (/lh3\.googleusercontent\.com\/d\//.test(url)) return `${url.split('=')[0]}=w${size}`;
  if (url.includes('/storage/v1/object/public/')) {
    const base = url.split('?')[0].replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    return `${base}?width=${size}&height=${size}&resize=contain&quality=60`;
  }
  return url;
};
