import { useId } from 'react';

export type BrandMarkProps = {
  size?: number;
  className?: string;
  decorative?: boolean;
};

function BrandMark({ size = 34, className, decorative = true }: BrandMarkProps) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `brand-gradient-${uid}`;
  const insetId = `brand-inset-${uid}`;
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
        <linearGradient id={gradientId} x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6FAA95" />
          <stop offset="1" stopColor="#5A8E7B" />
        </linearGradient>
        <linearGradient id={insetId} x1="32" y1="17" x2="32" y2="49" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.06" />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#173A2F" floodOpacity="0.2" />
        </filter>
      </defs>

      <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${gradientId})`} filter={`url(#${shadowId})`} />
      <rect x="9" y="9" width="46" height="46" rx="12" fill={`url(#${insetId})`} />

      <path
        d="M20 23.5C20 21.9 21.3 20.6 22.9 20.6H30.2C31.6 20.6 32.7 21.2 33.4 22.1C34.1 21.2 35.2 20.6 36.6 20.6H43.1C44.7 20.6 46 21.9 46 23.5V40.7C46 41.2 45.6 41.6 45.1 41.6H36.8C35.4 41.6 34.2 42.3 33.4 43.3C32.6 42.3 31.4 41.6 30 41.6H20.9C20.4 41.6 20 41.2 20 40.7V23.5Z"
        fill="#EAF5F1"
      />
      <path d="M33.4 22V43.2" stroke="#5A8E7B" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M23.8 26.2H29.4M23.8 29.8H29.4M37.3 26.2H42.2M37.3 29.8H42.2" stroke="#8DBAA9" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default BrandMark;
