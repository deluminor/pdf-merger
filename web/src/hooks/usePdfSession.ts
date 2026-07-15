import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { MAX_FILE_BYTES, MAX_FILES, MIN_MERGE_FILES } from '../constants/ui';
import type { AppState, MergeResult, QueuedFile } from '../types/queue';

const clientId = () => `local-${crypto.randomUUID()}`;
const isPdf = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

export function isRetryableFile(file: QueuedFile): boolean {
  return (
    file.error !== 'Not a PDF' &&
    file.error !== 'Too large — 50 MB max' &&
    !file.error?.startsWith('Up to ')
  );
}

type FileUpdater = (files: QueuedFile[]) => QueuedFile[];

export interface PdfSession {
  sessionId?: string;
  files: QueuedFile[];
  state: AppState;
  result?: MergeResult;
  message?: string;
  addFiles: (files: File[]) => Promise<void>;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (orderedIds: string[]) => void;
  merge: () => Promise<void>;
  reset: () => Promise<void>;
}

export function usePdfSession(): PdfSession {
  const [sessionId, setSessionId] = useState<string>();
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [state, setState] = useState<AppState>('empty');
  const [result, setResult] = useState<MergeResult>();
  const [message, setMessage] = useState<string>();
  const filesRef = useRef<QueuedFile[]>([]);
  const sessionRef = useRef<string>();
  const sessionPromiseRef = useRef<Promise<string | undefined>>();
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const sourceFilesRef = useRef(new Map<string, File>());
  const uploadControllersRef = useRef(new Map<string, AbortController>());
  const removeControllersRef = useRef(new Map<string, AbortController>());

  const updateFiles = useCallback((updater: FileUpdater) => {
    const next = updater(filesRef.current);
    filesRef.current = next;
    setFiles(next);
    return next;
  }, []);

  const createSession = useCallback((): Promise<string | undefined> => {
    if (sessionRef.current) return Promise.resolve(sessionRef.current);
    if (sessionPromiseRef.current) return sessionPromiseRef.current;

    const generation = generationRef.current;
    const pending = api
      .createSession()
      .then((id) => {
        if (!mountedRef.current || generation !== generationRef.current) {
          void api.cleanup(id).catch(() => undefined);
          return undefined;
        }

        sessionRef.current = id;
        setSessionId(id);

        return id;
      })
      .catch((error: unknown) => {
        if (mountedRef.current && generation === generationRef.current) {
          setState('error');
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not create a session.'
          );
        }
        return undefined;
      })
      .finally(() => {
        if (sessionPromiseRef.current === pending)
          sessionPromiseRef.current = undefined;
      });

    sessionPromiseRef.current = pending;
    return pending;
  }, []);

  const refreshState = useCallback(() => {
    const hasUploading = filesRef.current.some(
      (file) => file.status === 'uploading'
    );

    setState((current) =>
      current === 'success' || current === 'merging'
        ? current
        : hasUploading
          ? 'uploading'
          : 'ready'
    );
  }, []);

  const uploadOne = useCallback(
    async (
      id: string,
      file: File,
      activeSession: string,
      generation: number
    ) => {
      const controller = new AbortController();
      uploadControllersRef.current.get(id)?.abort();
      uploadControllersRef.current.set(id, controller);

      try {
        const [uploaded] = await api.upload(activeSession, [file], {
          signal: controller.signal,
        });
        if (
          !uploaded ||
          !mountedRef.current ||
          generation !== generationRef.current ||
          sessionRef.current !== activeSession ||
          uploadControllersRef.current.get(id) !== controller
        ) {
          return;
        }

        updateFiles((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  serverId: uploaded.id,
                  name: uploaded.name,
                  size: uploaded.size,
                  pages: uploaded.pages,
                  status: 'ready',
                  error: undefined,
                }
              : item
          )
        );
        sourceFilesRef.current.delete(id);
      } catch (error) {
        if (
          controller.signal.aborted ||
          !mountedRef.current ||
          generation !== generationRef.current ||
          sessionRef.current !== activeSession ||
          uploadControllersRef.current.get(id) !== controller
        )
          return;
        const reason =
          error instanceof Error ? error.message : 'Upload failed.';

        updateFiles((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: 'error', error: reason } : item
          )
        );
      } finally {
        if (uploadControllersRef.current.get(id) === controller)
          uploadControllersRef.current.delete(id);
        if (mountedRef.current && generation === generationRef.current)
          refreshState();
      }
    },
    [refreshState, updateFiles]
  );

  const addFiles = useCallback(
    async (incoming: File[]) => {
      if (!incoming.length) return;

      const activeSession = await createSession();
      if (!activeSession) return;

      const capacity = Math.max(0, MAX_FILES - filesRef.current.length);
      const accepted = incoming.slice(0, capacity);

      if (accepted.length < incoming.length)
        setMessage(`Up to ${MAX_FILES} PDFs can be added.`);
      else setMessage(undefined);

      if (!accepted.length) return;

      const generation = generationRef.current;
      const queued = accepted.map((file): QueuedFile => {
        const id = clientId();
        const validationError =
          isPdf(file) === false
            ? 'Not a PDF'
            : file.size > MAX_FILE_BYTES
              ? 'Too large — 50 MB max'
              : undefined;

        if (!validationError) sourceFilesRef.current.set(id, file);

        return {
          id,
          name: file.name,
          size: file.size,
          pages: null,
          status: validationError ? 'error' : 'uploading',
          error: validationError,
        };
      });
      updateFiles((current) => [...current, ...queued]);
      if (queued.some((file) => file.status === 'uploading'))
        setState('uploading');

      await Promise.all(
        queued
          .filter((file) => file.status === 'uploading')
          .map((file) =>
            uploadOne(
              file.id,
              sourceFilesRef.current.get(file.id)!,
              activeSession,
              generation
            )
          )
      );
      refreshState();
    },
    [createSession, refreshState, updateFiles, uploadOne]
  );

  const retry = useCallback(
    async (id: string) => {
      const file = sourceFilesRef.current.get(id);
      const activeSession = sessionRef.current ?? (await createSession());
      const queueItem = filesRef.current.find((item) => item.id === id);

      if (!file || !activeSession || !queueItem || !isRetryableFile(queueItem))
        return;

      const generation = generationRef.current;

      updateFiles((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status: 'uploading', error: undefined }
            : item
        )
      );

      setState('uploading');
      await uploadOne(id, file, activeSession, generation);
    },
    [createSession, updateFiles, uploadOne]
  );

  const remove = useCallback(
    async (id: string) => {
      const item = filesRef.current.find((file) => file.id === id);
      uploadControllersRef.current.get(id)?.abort();
      uploadControllersRef.current.delete(id);
      sourceFilesRef.current.delete(id);

      updateFiles((current) => current.filter((file) => file.id !== id));
      refreshState();

      const activeSession = sessionRef.current;
      const generation = generationRef.current;

      if (item?.status !== 'ready' || !activeSession || !item.serverId) return;

      const controller = new AbortController();
      removeControllersRef.current.set(id, controller);

      try {
        await api.deleteFile(activeSession, item.serverId, {
          signal: controller.signal,
        });
      } catch (error) {
        if (
          !controller.signal.aborted &&
          mountedRef.current &&
          generation === generationRef.current &&
          activeSession === sessionRef.current
        ) {
          setMessage(
            error instanceof Error ? error.message : 'Could not remove file.'
          );
        }
      } finally {
        if (removeControllersRef.current.get(id) === controller)
          removeControllersRef.current.delete(id);
      }
    },
    [refreshState, updateFiles]
  );

  const reorder = useCallback(
    (orderedIds: string[]) => {
      const byId = new Map(filesRef.current.map((file) => [file.id, file]));
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((file): file is QueuedFile => Boolean(file));

      if (reordered.length !== filesRef.current.length) return;

      updateFiles(() => reordered);
      refreshState();
    },
    [refreshState, updateFiles]
  );

  const merge = useCallback(async () => {
    const activeSession = sessionRef.current;
    const ready = filesRef.current.filter((file) => file.status === 'ready');

    if (!activeSession || ready.length < MIN_MERGE_FILES) return;

    const generation = generationRef.current;
    setState('merging');
    setMessage(undefined);

    try {
      const merged = await api.merge(
        activeSession,
        ready.flatMap((file) => (file.serverId ? [file.serverId] : []))
      );

      if (
        !mountedRef.current ||
        generation !== generationRef.current ||
        sessionRef.current !== activeSession
      ) {
        return;
      }

      setResult(merged);
      setState('success');
    } catch (error) {
      if (
        !mountedRef.current ||
        generation !== generationRef.current ||
        sessionRef.current !== activeSession
      ) {
        return;
      }

      setState('error');
      setMessage(error instanceof Error ? error.message : 'Merge failed.');
    }
  }, []);

  const reset = useCallback(async () => {
    generationRef.current += 1;
    const oldSession = sessionRef.current;

    sessionRef.current = undefined;
    sessionPromiseRef.current = undefined;

    uploadControllersRef.current.forEach((controller) => controller.abort());
    uploadControllersRef.current.clear();
    removeControllersRef.current.forEach((controller) => controller.abort());
    removeControllersRef.current.clear();
    sourceFilesRef.current.clear();

    updateFiles(() => []);
    setSessionId(undefined);
    setResult(undefined);
    setMessage(undefined);
    setState('empty');

    if (oldSession) await api.cleanup(oldSession).catch(() => undefined);

    await createSession();
  }, [createSession, updateFiles]);

  useEffect(() => {
    void createSession();
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;

      uploadControllersRef.current.forEach((controller) => controller.abort());
      removeControllersRef.current.forEach((controller) => controller.abort());

      if (sessionRef.current)
        void api.cleanup(sessionRef.current).catch(() => undefined);
    };
  }, [createSession]);

  return {
    sessionId,
    files,
    state,
    result,
    message,
    addFiles,
    retry,
    remove,
    reorder,
    merge,
    reset,
  };
}
