export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MIN_MERGE_FILES = 2;
export const ACCEPTED_MIME = 'application/pdf';

export const DURATION = {
  instant: 0.1,
  fast: 0.16,
  base: 0.24,
  slow: 0.36,
  page: 0.48,
} as const;

export const EASE = {
  outQuart: [0.25, 1, 0.5, 1],
  inQuart: [0.5, 0, 0.75, 0],
  inOutQuart: [0.76, 0, 0.24, 1],
  outExpo: [0.16, 1, 0.3, 1],
} as const;

export const SPRING = {
  dropSettle: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 },
  reflow: { type: 'spring', stiffness: 500, damping: 40 },
} as const;

export const DRAG_ACTIVATION_DISTANCE = 6;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
