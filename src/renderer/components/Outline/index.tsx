import { useEffect, useMemo, useRef } from 'react';
import './Outline.css';

interface HeadingItem {
  level: number;
  text: string;
  id: string;
}

interface OutlineProps {
  headings: HeadingItem[];
  onHeadingClick?: (id: string) => void;
  visible?: boolean;
  activeHeadingId?: string | null;
  maxLevel?: number;
}

export default function Outline({
  headings,
  onHeadingClick,
  visible = true,
  activeHeadingId = null,
  maxLevel = 6,
}: OutlineProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const outlineItems = useMemo(() => {
    return headings
      .filter((heading) => heading.level <= maxLevel)
      .map((heading) => ({
        ...heading,
        indent: (heading.level - 1) * 12,
      }));
  }, [headings, maxLevel]);

  useEffect(() => {
    if (!activeHeadingId || !contentRef.current) return;
    const activeNode = contentRef.current.querySelector<HTMLElement>(`[data-heading-id="${activeHeadingId}"]`);
    if (!activeNode) return;
    activeNode.scrollIntoView({ block: 'nearest' });
  }, [activeHeadingId, outlineItems]);

  if (!visible || outlineItems.length === 0) {
    return null;
  }

  return (
    <div className="outline-panel">
      <div className="outline-header">
        <span className="outline-title">大纲</span>
        <span className="outline-count">
          {outlineItems.length}/{headings.length}
        </span>
      </div>
      <div className="outline-content" ref={contentRef}>
        {outlineItems.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            data-heading-id={item.id}
            className={`outline-item ${activeHeadingId === item.id ? 'active' : ''}`}
            style={{ paddingLeft: 12 + item.indent }}
            onClick={() => onHeadingClick?.(item.id)}
            title={item.text}
          >
            <span className={`outline-dot outline-dot-h${item.level}`} />
            <span className="outline-text">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { HeadingItem, OutlineProps };
