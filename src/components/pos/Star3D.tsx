import { useId } from 'react';

/** Dimensional glossy gold star (gradient body, bevel facets, specular highlight). */
export const Star3D = ({ size = 20, active = true, className = '' }: { size?: number; active?: boolean; className?: string }) => {
  const id = useId().replace(/:/g, '');
  const body = active ? ['#FFF3B0', '#FFC93C', '#F59E0B', '#B45309'] : ['#F8FAFC', '#E2E8F0', '#CBD5E1', '#94A3B8'];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={`pos-star3d ${active ? 'is-active' : ''} ${className}`} aria-hidden>
      <defs>
        <linearGradient id={`b${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={body[0]} />
          <stop offset="0.35" stopColor={body[1]} />
          <stop offset="0.75" stopColor={body[2]} />
          <stop offset="1" stopColor={body[3]} />
        </linearGradient>
        <radialGradient id={`h${id}`} cx="0.38" cy="0.28" r="0.45">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={`s${id}`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="2.2" stdDeviation="1.8" floodColor={active ? '#B45309' : '#475569'} floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter={`url(#s${id})`}>
        <path d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2l-12.5 6.5 2.4-13.8-10-9.8 13.9-2z"
          fill={`url(#b${id})`} stroke={active ? '#92400E' : '#64748B'} strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" />
        {/* bevel facets */}
        <path d="M24 3.5L24 24 30.2 16.1z M44.1 18.1L24 24 34.1 27.9z" fill="#fff" opacity="0.22" />
        <path d="M36.5 41.7L24 24 24 35.2z M11.5 41.7L24 24 13.9 27.9z" fill="#000" opacity="0.12" />
        <path d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2l-12.5 6.5 2.4-13.8-10-9.8 13.9-2z" fill={`url(#h${id})`} />
      </g>
    </svg>
  );
};
