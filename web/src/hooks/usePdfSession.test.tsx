import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { MAX_FILES } from '../constants/ui';
import { usePdfSession } from './usePdfSession';

vi.mock('../api/client', () => ({
  api: {
    createSession: vi.fn(),
    upload: vi.fn(),
    deleteFile: vi.fn(),
    merge: vi.fn(),
    cleanup: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);
const pdf = (name: string) =>
  new File(['pdf'], name, { type: 'application/pdf' });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockedApi.cleanup.mockResolvedValue(undefined);
});
afterEach(() => vi.resetAllMocks());

describe('usePdfSession', () => {
  it('deduplicates mount and concurrent-add session creation without replacing the session', async () => {
    const session = deferred<string>();
    const upload =
      deferred<
        Array<{ id: string; name: string; size: number; pages: number }>
      >();
    mockedApi.createSession.mockReturnValue(session.promise);
    mockedApi.upload.mockReturnValue(upload.promise);
    const { result } = renderHook(() => usePdfSession());
    act(() => {
      void result.current.addFiles([pdf('one.pdf')]);
      void result.current.addFiles([pdf('two.pdf')]);
    });
    expect(mockedApi.createSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      session.resolve('session-1');
      await session.promise;
    });
    await waitFor(() => expect(mockedApi.upload).toHaveBeenCalledTimes(2));
    const clientIds = result.current.files.map((file) => file.id);
    expect(clientIds).toHaveLength(2);
    await act(async () => {
      upload.resolve([
        { id: 'server-file', name: 'one.pdf', size: 3, pages: 1 },
      ]);
      await upload.promise;
    });
    await waitFor(() =>
      expect(
        result.current.files.every((file) => file.status === 'ready')
      ).toBe(true)
    );
    expect(result.current.sessionId).toBe('session-1');
    expect(result.current.files.map((file) => file.id)).toEqual(clientIds);
    expect(result.current.files.map((file) => file.serverId)).toEqual([
      'server-file',
      'server-file',
    ]);
  });

  it('reserves capacity before uploads resolve', async () => {
    mockedApi.createSession.mockResolvedValue('session-1');
    const upload =
      deferred<
        Array<{ id: string; name: string; size: number; pages: number }>
      >();
    mockedApi.upload.mockReturnValue(upload.promise);
    const { result } = renderHook(() => usePdfSession());
    await waitFor(() => expect(mockedApi.createSession).toHaveBeenCalled());
    await act(async () => {
      void result.current.addFiles(
        Array.from({ length: MAX_FILES }, (_, index) => pdf(`${index}.pdf`))
      );
    });
    await act(async () => {
      void result.current.addFiles([pdf('overflow.pdf')]);
    });
    expect(result.current.files).toHaveLength(MAX_FILES);
  });

  it('ignores an upload completion after its row is removed', async () => {
    mockedApi.createSession.mockResolvedValue('session-1');
    const upload =
      deferred<
        Array<{ id: string; name: string; size: number; pages: number }>
      >();
    mockedApi.upload.mockReturnValue(upload.promise);
    const { result } = renderHook(() => usePdfSession());
    await waitFor(() => expect(result.current.sessionId).toBe('session-1'));
    act(() => {
      void result.current.addFiles([pdf('one.pdf')]);
    });
    await waitFor(() => expect(result.current.files).toHaveLength(1));
    const localId = result.current.files[0].id;
    await act(async () => {
      await result.current.remove(localId);
    });
    expect(mockedApi.upload.mock.calls[0][2]?.signal?.aborted).toBe(true);
    await act(async () => {
      upload.resolve([
        { id: 'server-file', name: 'one.pdf', size: 3, pages: 1 },
      ]);
      await upload.promise;
    });
    expect(result.current.files).toEqual([]);
  });

  it('ignores an upload completion after reset', async () => {
    mockedApi.createSession
      .mockResolvedValueOnce('old-session')
      .mockResolvedValueOnce('new-session');
    const upload =
      deferred<
        Array<{ id: string; name: string; size: number; pages: number }>
      >();
    mockedApi.upload.mockReturnValue(upload.promise);
    const { result } = renderHook(() => usePdfSession());
    await waitFor(() => expect(result.current.sessionId).toBe('old-session'));
    act(() => {
      void result.current.addFiles([pdf('one.pdf')]);
    });
    await waitFor(() => expect(result.current.files).toHaveLength(1));
    await act(async () => {
      await result.current.reset();
    });
    expect(mockedApi.upload.mock.calls[0][2]?.signal?.aborted).toBe(true);
    await act(async () => {
      upload.resolve([
        { id: 'server-file', name: 'one.pdf', size: 3, pages: 1 },
      ]);
      await upload.promise;
    });
    expect(result.current.files).toEqual([]);
  });
});
