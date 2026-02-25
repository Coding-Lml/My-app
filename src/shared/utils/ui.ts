export function clampSelectionIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export function averageProgress(levels: number[]): number {
  if (levels.length === 0) return 0;
  const total = levels.reduce((sum, level) => sum + level, 0);
  return Math.round(total / levels.length);
}
