import type { ElectronAPI } from '@shared/types/ipc';

export {};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
