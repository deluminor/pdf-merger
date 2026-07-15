export type UploadStatus = 'uploading' | 'ready' | 'error' | 'skipped';

export interface QueuedFile {
  id: string;
  serverId?: string;
  name: string;
  size: number;
  pages: number | null;
  status: UploadStatus;
  error?: string;
}

export interface MergeResult {
  totalPages: number;
  fileSizeMb: number;
  skipped: string[];
  downloadUrl: string;
}

export type AppState =
  | 'empty'
  | 'uploading'
  | 'ready'
  | 'reordering'
  | 'merging'
  | 'success'
  | 'error';

export type MergeBarStatus = 'idle' | 'busy' | 'disabled';
