import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('maps merge DTOs and sends requested order', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            download_url: '/download',
            pages: 4,
            size_mb: 1.25,
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.merge('session-1', ['b', 'a'])).resolves.toEqual({
      downloadUrl: '/download',
      totalPages: 4,
      fileSizeMb: 1.25,
      skipped: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/session/session-1/merge',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ order: ['b', 'a'] }),
      })
    );
  });

  it('preserves API detail in an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: 'Session expired' }), {
            status: 404,
          })
        )
    );
    await expect(api.createSession()).rejects.toMatchObject({
      message: 'Session expired',
      status: 404,
      detail: 'Session expired',
    });
  });

  it('reports network failures consistently', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(api.createSession()).rejects.toMatchObject({
      status: 0,
      message: 'Network error. Check that the API is running.',
    });
  });
});
