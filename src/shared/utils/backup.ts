import type { BackupCountMap, BackupImportStats } from '@shared/types/ipc';

const BACKUP_COUNT_KEYS: Array<keyof BackupCountMap> = [
  'todos',
  'checkIns',
  'studyProgress',
  'studyPlans',
  'milestones',
  'settings',
];

export function sumBackupCountMap(counts: BackupCountMap): number {
  return BACKUP_COUNT_KEYS.reduce((total, key) => total + counts[key], 0);
}

export function summarizeBackupImport(stats: BackupImportStats): {
  created: number;
  updated: number;
  skipped: number;
} {
  return {
    created: sumBackupCountMap(stats.created),
    updated: sumBackupCountMap(stats.updated),
    skipped: sumBackupCountMap(stats.skipped),
  };
}
