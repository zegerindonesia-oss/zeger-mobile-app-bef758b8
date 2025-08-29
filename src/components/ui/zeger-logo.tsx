import React from 'react';

interface ZegerLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ZegerLogo: React.FC<ZegerLogoProps> = ({ className = "", size = "md" }) => {
  const sizeClasses = {
    sm: "w-24 h-24",
    md: "w-32 h-32", 
    lg: "w-48 h-48"
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl"
  };

  return (
    <div className={`flex flex-col items-center justify-center ${sizeClasses[size]} ${className}`}>
      <img
        src="/lovable-uploads/af4d1a9a-5f56-4c8a-81a2-eb098eb7c2cb.png"
        alt="Zeger Coffee logo"
        className="w-full h-full object-contain filter brightness-0 invert"
        loading="lazy"
      />
    </div>
  );
};