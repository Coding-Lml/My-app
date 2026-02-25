import { useId } from 'react';

export type BrandMarkProps = {
  size?: number;
  className?: string;
  decorative?: boolean;
};

function BrandMark({ size = 34, className, decorative = true }: BrandMarkProps) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `brand-gradient-${uid}`;
  const highlightId = `brand-highlight-${uid}`;
  const shadowId = `brand-shadow-${uid}`;
  const a11yProps = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': 'Academia' } as const);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...a11yProps}
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5F9785" />
          <stop offset="1" stopColor="#477766" />
        </linearGradient>
        <linearGradient id={highlightId} x1="32" y1="4" x2="32" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#173A2F" floodOpacity="0.24" />
        </filter>
      </defs>

      <rect x="4" y="4" width="56" height="56" rx="18" fill={`url(#${gradientId})`} filter={`url(#${shadowId})`} />
      <rect x="4" y="4" width="56" height="10" rx="18" fill={`url(#${highlightId})`} />
      <circle cx="32" cy="31" r="8" fill="#EAF5F1" />
    </svg>
  );
}

export default BrandMark;
