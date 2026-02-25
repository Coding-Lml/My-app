import { describe, expect, it } from 'vitest';
import { averageProgress, clampSelectionIndex } from '../src/shared/utils/ui';
import { resolveStudyPlanDateRange, validateTargetHours } from '../src/shared/utils/studyPlan';
import { sumBackupCountMap, summarizeBackupImport } from '../src/shared/utils/backup';

describe('shared ui utils', () => {
  it('clamps selection index to 0 when list is empty', () => {
    expect(clampSelectionIndex(4, 0)).toBe(0);
    expect(clampSelectionIndex(-2, 0)).toBe(0);
  });

  it('clamps selection index within bounds', () => {
    expect(clampSelectionIndex(-1, 5)).toBe(0);
    expect(clampSelectionIndex(6, 5)).toBe(4);
    expect(clampSelectionIndex(2, 5)).toBe(2);
  });

  it('computes average progress with rounded value', () => {
    expect(averageProgress([])).toBe(0);
    expect(averageProgress([50, 60, 70])).toBe(60);
    expect(averageProgress([33, 33, 34])).toBe(33);
  });
});

describe('study plan utils', () => {
  it('resolves valid date range', () => {
    const result = resolveStudyPlanDateRange(100, 200, { start_date: 120 });
    expect(result.start).toBe(120);
    expect(result.end).toBe(200);
    expect(result.error).toBeUndefined();
  });

  it('returns error for invalid date range', () => {
    const result = resolveStudyPlanDateRange(100, 200, { start_date: 300, end_date: 250 });
    expect(result.error).toBe('结束日期不能早于开始日期');
  });

  it('validates target hours', () => {
    expect(validateTargetHours(undefined)).toBeUndefined();
    expect(validateTargetHours(2)).toBeUndefined();
    expect(validateTargetHours(0)).toBe('目标学习时长必须大于等于 1 小时');
  });
});

describe('backup utils', () => {
  it('sums backup count map', () => {
    expect(
      sumBackupCountMap({
        todos: 1,
        checkIns: 2,
        studyProgress: 3,
        studyPlans: 4,
        milestones: 5,
        settings: 6,
      })
    ).toBe(21);
  });

  it('summarizes backup import stats', () => {
    const summary = summarizeBackupImport({
      created: {
        todos: 3,
        checkIns: 1,
        studyProgress: 0,
        studyPlans: 2,
        milestones: 4,
        settings: 0,
      },
      updated: {
        todos: 0,
        checkIns: 2,
        studyProgress: 1,
        studyPlans: 0,
        milestones: 0,
        settings: 3,
      },
      skipped: {
        todos: 1,
        checkIns: 0,
        studyProgress: 1,
        studyPlans: 0,
        milestones: 2,
        settings: 0,
      },
    });

    expect(summary).toEqual({
      created: 10,
      updated: 6,
      skipped: 4,
    });
  });
});
