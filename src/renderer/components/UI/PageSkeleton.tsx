import React from 'react';

interface SkeletonBlockProps {
  height?: number | string;
  width?: number | string;
  borderRadius?: number | string;
  style?: React.CSSProperties;
}

export function SkeletonBlock({ height = 16, width = '100%', borderRadius = 10, style }: SkeletonBlockProps) {
  return (
    <div
      className="skeleton skeleton-block"
      style={{ height, width, borderRadius, flexShrink: 0, ...style }}
    />
  );
}

/** Default page-level skeleton shown during Suspense */
export function PageSkeleton() {
  return (
    <div className="skeleton-page" style={{ maxWidth: 1160, margin: '0 auto' }}>
      {/* Title */}
      <SkeletonBlock height={36} width={200} borderRadius={10} />

      {/* Context bar */}
      <SkeletonBlock height={44} borderRadius={14} />

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.28fr 1fr', gap: 14 }}>
        <SkeletonBlock height={280} borderRadius={14} />
        <SkeletonBlock height={280} borderRadius={14} />
      </div>

      {/* Full-width card */}
      <SkeletonBlock height={180} borderRadius={14} />
    </div>
  );
}

export default PageSkeleton;
