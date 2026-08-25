import React from 'react';

export default function RosLogo({ className = '', showTagline = false, size = 'default' }) {
  const isLarge = size === 'large';
  const iconSize = isLarge ? 48 : 38;

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* GOOGLE MAIL MERGE & ROS OUTREACH LOGO */}
      <div className="relative flex items-center justify-center">
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_0_8px_rgba(0,194,255,0.3)]"
        >
          <path
            d="M6 10C6 7.79086 7.79086 6 10 6H38C40.2091 6 42 7.79086 42 10V14C42 15.5 41.2 16.9 39.9 17.7L28 25.5V38L20 42V25.5L8.1 17.7C6.8 16.9 6 15.5 6 14V10Z"
            stroke="#1E3A5F"
            strokeWidth="2"
            fill="#111827"
          />
          <path
            d="M12 12H36M16 18H32M20 24H28M24 24V36"
            stroke="#00E5A0"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="14" cy="12" r="2.5" fill="#00C2FF" />
          <circle cx="34" cy="12" r="2.5" fill="#F97316" />
          <circle cx="24" cy="18" r="2" fill="#00E5A0" />
          <circle cx="24" cy="36" r="3" fill="#00C2FF" className="animate-pulse" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`${isLarge ? 'text-2xl' : 'text-xl'} font-bold tracking-wider text-white font-['Space_Grotesk']`}>
            R<span className="text-[#00C2FF]">O</span><span className="text-[#00E5A0]">S</span>
          </span>
          <span className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-[#1E3A5F]/60 text-[#00C2FF] border border-[#00C2FF]/30 uppercase">
            TRACKING
          </span>
        </div>
        {showTagline && (
          <span className="text-[10px] tracking-wide text-[#7B7B7B] uppercase font-medium mt-0.5">
            Ruhit Outreach Solutions
          </span>
        )}
      </div>
    </div>
  );
}
