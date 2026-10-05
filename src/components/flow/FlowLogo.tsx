interface Props { variant?: 'light' | 'dark'; size?: 'sm' | 'md' | 'lg'; showTagline?: boolean; }

export const FlowMark = ({ className = 'h-9 w-9' }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="hsl(355 100% 65%)" />
        <stop offset="1" stopColor="hsl(354 77% 45%)" />
      </linearGradient>
    </defs>
    <path d="M10 26C12 13 23 6 37 6h21c-2 9-9 15-19 15H25c-6 0-11 2-15 5z" fill="url(#flowGrad)" />
    <path d="M22 30h22c-1 9-8 15-17 15h-1c-1 0-2 1-2 2v11c-9-3-14-11-14-19 0-5 4-9 12-9z" fill="url(#flowGrad)" />
  </svg>
);

export const FlowLogo = ({ variant = 'light', size = 'md', showTagline = true }: Props) => {
  const mark = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
  const text = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  const ink = variant === 'dark' ? 'text-background' : 'flow-ink';
  return (
    <div className="flex items-center gap-2">
      <FlowMark className={mark} />
      <div className="leading-none">
        <div className={`${text} font-extrabold tracking-tight ${ink}`}>
          Flow<span className="flow-red">F&amp;B</span><sup className="text-[0.4em] align-super ml-0.5">™</sup>
        </div>
        {showTagline && <div className={`text-[9px] tracking-[0.45em] mt-1 ${variant === 'dark' ? 'text-background/70' : 'flow-muted'}`}>F &amp; B &nbsp;E R P</div>}
      </div>
    </div>
  );
};
