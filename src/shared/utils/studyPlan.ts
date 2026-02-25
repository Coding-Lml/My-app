import type { StudyPlanUpdatePayload } from '@shared/types/ipc';

export function resolveStudyPlanDateRange(
  currentStart: number,
  currentEnd: number,
  updates: StudyPlanUpdatePayload
): { start: number; end: number; error?: string } {
  const start = updates.start_date ?? currentStart;
  const end = updates.end_date ?? currentEnd;
  if (end < start) {
    return { start, end, error: '结束日期不能早于开始日期' };
  }
  return { start, end };
}

export function validateTargetHours(targetHours: number | undefined): string | undefined {
  if (targetHours === undefined) return undefined;
  if (!Number.isFinite(targetHours) || targetHours < 1) {
    return '目标学习时长必须大于等于 1 小时';
  }
  return undefined;
}
