export type TvMediaType = 'youtube' | 'gdrive' | 'video' | 'image' | 'spotify';
export interface TvMediaItem { type: TvMediaType; url: string; duration?: number }

export const TV_MEDIA_LABEL: Record<TvMediaType, string> = {
  youtube: 'YouTube / YouTube Live',
  gdrive: 'Google Drive (file video)',
  video: 'File video .mp4',
  image: 'Banner gambar',
  spotify: 'Spotify playlist',
};

export const youtubeId = (url: string) =>
  url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/)?.[1];
export const gdriveId = (url: string) =>
  url.match(/\/d\/([\w-]{10,})/)?.[1] || url.match(/[?&]id=([\w-]{10,})/)?.[1];
export const spotifyEmbed = (url: string) => {
  const m = url.match(/open\.spotify\.com\/(?:embed\/)?(playlist|album|track|artist|show|episode)\/([\w]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` : null;
};

/** Guess type from a pasted link so cashiers just paste. */
export const detectMediaType = (url: string): TvMediaType => {
  const u = url.toLowerCase();
  if (u.includes('youtu')) return 'youtube';
  if (u.includes('drive.google')) return 'gdrive';
  if (u.includes('spotify.com')) return 'spotify';
  if (/\.(png|jpe?g|webp|gif)(\?|$)/.test(u)) return 'image';
  return 'video';
};

export const isDriveFolder = (url: string) => /drive\.google\.com\/drive\/folders/.test(url);
