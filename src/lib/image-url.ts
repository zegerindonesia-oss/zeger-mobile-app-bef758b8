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
