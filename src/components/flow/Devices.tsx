import { ReactNode } from 'react';

export const MacBook = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`relative ${className}`}>
    <div className="flow-mac-lid rounded-[22px] p-[10px] pt-[14px] relative">
      <div className="absolute top-[5px] left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-foreground/60" />
      <div className="rounded-[10px] overflow-hidden bg-background aspect-[16/10]">{children}</div>
    </div>
    <div className="flow-mac-base mx-[-6%] h-4 rounded-b-[18px] relative">
      <div className="absolute left-1/2 -translate-x-1/2 top-0 h-1.5 w-[16%] rounded-b-lg bg-foreground/20" />
    </div>
  </div>
);

export const IPhone = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`flow-iphone rounded-[44px] p-[9px] relative ${className}`}>
    <div className="absolute -left-[3px] top-24 h-10 w-[3px] rounded-l bg-foreground/70" />
    <div className="absolute -right-[3px] top-28 h-16 w-[3px] rounded-r bg-foreground/70" />
    <div className="rounded-[36px] overflow-hidden bg-background relative aspect-[9/19.5]">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-[34%] rounded-full bg-foreground z-10" />
      {children}
    </div>
  </div>
);

export const IPad = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`flow-iphone rounded-[30px] p-[12px] ${className}`}>
    <div className="rounded-[20px] overflow-hidden bg-background aspect-[4/3]">{children}</div>
  </div>
);
