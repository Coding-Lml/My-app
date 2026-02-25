import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const allowedRoots = new Set<string>();
let initialized = false;

function normalizeComparablePath(targetPath: string): string {
  let normalized = path.normalize(path.resolve(targetPath));
  if (normalized.length > 1 && normalized.endsWith(path.sep)) {
    normalized = normalized.slice(0, -1);
  }
  if (process.platform === 'win32') {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

function resolveBestPath(targetPath: string): string {
  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function isChildPath(parentPath: string, childPath: string): boolean {
  return childPath === parentPath || childPath.startsWith(`${parentPath}${path.sep}`);
}

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  try {
    const userDataPath = app.getPath('userData');
    if (userDataPath) {
      allowPath(userDataPath);
    }
  } catch {
    // Ignore before app lifecycle is ready.
  }
}

export function allowPath(targetPath: string): void {
  if (!targetPath) return;
  ensureInitialized();
  const resolved = resolveBestPath(targetPath);
  let root = resolved;

  try {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      root = path.dirname(resolved);
    }
  } catch {
    root = path.dirname(resolved);
  }

  allowedRoots.add(normalizeComparablePath(root));
}

export function isPathAllowed(targetPath: string): boolean {
  if (!targetPath) return false;
  ensureInitialized();
  const resolved = normalizeComparablePath(resolveBestPath(targetPath));

  for (const root of allowedRoots) {
    if (isChildPath(root, resolved)) {
      return true;
    }
  }
  return false;
}

export function isParentPathAllowed(targetPath: string): boolean {
  return isPathAllowed(path.dirname(targetPath));
}

export function getPathAccessError(targetPath: string): string {
  return `Access denied: ${targetPath}`;
}
