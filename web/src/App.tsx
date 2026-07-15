import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AppLayout } from './components/AppLayout';
import { Dropzone } from './components/Dropzone';
import { MergeBar } from './components/MergeBar';
import { PdfQueue } from './components/PdfQueue';
import { DURATION, EASE, MIN_MERGE_FILES } from './constants/ui';
import { usePdfSession } from './hooks/usePdfSession';
import type { MergeResult } from './types/queue';

export function App(): JSX.Element {
  const session = usePdfSession();
  const reducedMotion = useReducedMotion();
  const readyCount = session.files.filter(
    (file) => file.status === 'ready'
  ).length;

  const mergeStatus =
    session.state === 'merging'
      ? 'busy'
      : readyCount < MIN_MERGE_FILES
        ? 'disabled'
        : 'idle';

  const transition = reducedMotion
    ? { duration: 0.12 }
    : { duration: DURATION.page, ease: EASE.outExpo };

  return (
    <AppLayout>
      <AnimatePresence mode="wait">
        {session.state === 'success' && session.result ? (
          <SuccessPanel
            key="success"
            result={session.result}
            count={readyCount}
            onReset={() => void session.reset()}
            reducedMotion={reducedMotion}
          />
        ) : (
          <motion.div
            key="queue"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            {session.message ? (
              <ErrorNotice
                message={session.message}
                onReset={() => void session.reset()}
              />
            ) : null}
            {session.files.length === 0 ? (
              <Dropzone
                variant="empty"
                onFiles={(selected) => void session.addFiles(selected)}
                disabled={session.state === 'merging'}
              />
            ) : (
              <PdfQueue
                files={session.files}
                disabled={session.state === 'merging'}
                onAddFiles={(selected) => void session.addFiles(selected)}
                onReorder={session.reorder}
                onRemove={(id) => void session.remove(id)}
                onRetry={(id) => void session.retry(id)}
                onClear={() => void session.reset()}
              />
            )}
            <AnimatePresence initial={false}>
              {session.files.length > 0 ? (
                <MergeBar
                  key="merge-bar"
                  count={readyCount}
                  status={mergeStatus}
                  onMerge={() => void session.merge()}
                />
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function ErrorNotice({
  message,
  onReset,
}: {
  message: string;
  onReset: () => void;
}): JSX.Element {
  return (
    <div
      role="alert"
      className="mb-4 rounded-md border-l-[3px] border-danger bg-danger-soft px-4 py-3 text-body text-danger"
    >
      {message}{' '}
      <button type="button" className="ml-2 underline" onClick={onReset}>
        Start over
      </button>
    </div>
  );
}

function formatMergeSize(mb: number): string {
  if (mb < 0.1) return `${Math.max(1, Math.round(mb * 1024))} KB`;
  return `${mb.toFixed(1)} MB`;
}

function SuccessPanel({
  result,
  count,
  onReset,
  reducedMotion,
}: {
  result: MergeResult;
  count: number;
  onReset: () => void;
  reducedMotion: boolean | null;
}): JSX.Element {
  return (
    <motion.section
      initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0.12 : DURATION.page,
        ease: EASE.outExpo,
      }}
      className="rounded-xl bg-surface px-6 py-12 text-center shadow-sm sm:px-10"
    >
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="mx-auto h-12 w-12 text-success"
      >
        <motion.path
          d="M12 25l8 8 16-18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: reducedMotion ? 0.12 : DURATION.slow,
            ease: EASE.outQuart,
          }}
        />
      </motion.svg>
      <h2 className="mt-5 font-display text-h1 text-ink">Merged.</h2>
      <p className="mt-3 text-body-lg text-ink-secondary">
        {result.totalPages} pages · {formatMergeSize(result.fileSizeMb)} ·{' '}
        {count} files combined.
      </p>
      {result.skipped.length > 0 ? (
        <p
          role="status"
          className="mt-3 rounded-md border-l-[3px] border-warning bg-warning-soft px-4 py-3 text-left text-body text-warning"
        >
          {result.skipped.length} file{result.skipped.length === 1 ? '' : 's'}{' '}
          couldn't be read and {result.skipped.length === 1 ? 'was' : 'were'}{' '}
          left out: {result.skipped.join(', ')}.
        </p>
      ) : null}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <a
          className="rounded-md bg-accent px-5 py-3 text-title text-surface transition-colors hover:bg-accent-hover"
          href={result.downloadUrl}
        >
          Download PDF
        </a>
        <button
          type="button"
          className="rounded-md border border-hairline px-5 py-3 text-title text-ink-secondary hover:border-hairline-strong"
          onClick={onReset}
        >
          Merge another
        </button>
      </div>
    </motion.section>
  );
}
