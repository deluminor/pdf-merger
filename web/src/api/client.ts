export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  pages: number;
}

export interface ApiMergeResult {
  downloadUrl: string;
  totalPages: number;
  fileSizeMb: number;
  skipped: string[];
}

const API_ROOT = '/api';
type RequestOptions = Pick<RequestInit, 'signal'>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, init);
  } catch {
    throw new ApiError('Network error. Check that the API is running.', 0);
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = (await response.json()) as { detail?: unknown };
      detail = typeof body.detail === 'string' ? body.detail : undefined;
    } catch {
      // A non-JSON error is still represented by the HTTP status below.
    }
    throw new ApiError(
      detail ?? `Request failed (${response.status})`,
      response.status,
      detail
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  async createSession(options?: RequestOptions): Promise<string> {
    const result = await request<{ id: string }>('/session', {
      method: 'POST',
      ...options,
    });
    return result.id;
  },

  upload(
    sessionId: string,
    files: File[],
    options?: RequestOptions
  ): Promise<UploadedFile[]> {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return request<UploadedFile[]>(`/session/${sessionId}/files`, {
      method: 'POST',
      body: form,
      ...options,
    });
  },

  deleteFile(
    sessionId: string,
    fileId: string,
    options?: RequestOptions
  ): Promise<void> {
    return request<void>(`/session/${sessionId}/files/${fileId}`, {
      method: 'DELETE',
      ...options,
    });
  },

  async merge(
    sessionId: string,
    order: string[],
    options?: RequestOptions
  ): Promise<ApiMergeResult> {
    const result = await request<{
      download_url: string;
      pages: number;
      size_mb: number;
      skipped?: unknown;
    }>(`/session/${sessionId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
      ...options,
    });
    return {
      downloadUrl: result.download_url,
      totalPages: result.pages,
      fileSizeMb: result.size_mb,
      skipped: Array.isArray(result.skipped)
        ? result.skipped.filter(
            (name): name is string => typeof name === 'string'
          )
        : [],
    };
  },

  downloadUrl(sessionId: string): string {
    return `${API_ROOT}/session/${sessionId}/download`;
  },

  cleanup(sessionId: string, options?: RequestOptions): Promise<void> {
    return request<void>(`/session/${sessionId}`, {
      method: 'DELETE',
      ...options,
    });
  },
};
