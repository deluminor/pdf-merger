import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ButtonHTMLAttributes, CSSProperties, Ref } from 'react';
import { formatSize } from '../constants/ui';
import type { QueuedFile } from '../types/queue';

interface QueueRowProps {
  file: QueuedFile;
  index: number;
  total: number;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  isGhost?: boolean;
}

type DragHandleProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
};

interface QueueRowCardProps {
  file: QueuedFile;
  index: number;
  total: number;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  dragHandleProps?: DragHandleProps;
  elevated?: boolean;
  isGhost?: boolean;
  style?: CSSProperties;
}

export function QueueRowCard({
  file,
  index,
  total,
  onRemove,
  onRetry,
  dragHandleProps,
  elevated = false,
  isGhost = false,
  style,
}: QueueRowCardProps): JSX.Element {
  const isError = file.status === 'error';
  const isSkipped = file.status === 'skipped';
  const isUploading = file.status === 'uploading';

  return (
    <div
      style={style}
      className={[
        'flex items-center gap-3 rounded-md border px-5 py-4',
        elevated
          ? 'border-hairline-strong bg-surface-raised shadow-lift scale-[1.03] cursor-grabbing'
          : isGhost
            ? 'border-hairline border-dashed bg-surface-sunken/80 shadow-none opacity-40'
            : 'border-hairline bg-surface shadow-xs hover:border-hairline-strong hover:shadow-sm',
        !elevated && !isGhost && isError
          ? 'border-danger/40 bg-danger-soft'
          : '',
        !elevated && !isGhost && isSkipped
          ? 'border-warning/40 bg-warning-soft'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-label={`Position ${index} of ${total} in the merged file`}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[12px] font-medium text-accent"
      >
        {index}
      </span>

      <button
        type="button"
        aria-label={`Reorder ${file.name}`}
        className={[
          'shrink-0 px-1 text-ink-muted transition-colors duration-fast',
          elevated
            ? 'cursor-grabbing text-accent'
            : 'cursor-grab hover:text-accent active:cursor-grabbing',
        ].join(' ')}
        {...dragHandleProps}
      >
        <GripGlyph />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-title text-ink">{file.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {isUploading ? (
            <>
              <span className="sr-only">Uploading {file.name}</span>
              <span
                aria-hidden="true"
                className="h-3 w-24 animate-pulse rounded-sm bg-surface-sunken"
              />
            </>
          ) : isError || isSkipped ? (
            <span
              className={`flex items-center gap-2 text-caption ${isError ? 'text-danger' : 'text-warning'}`}
            >
              {file.error ?? (isError ? 'Upload failed' : 'Skipped')}
              {isError && onRetry ? (
                <button
                  type="button"
                  className="underline hover:no-underline"
                  onClick={() => onRetry(file.id)}
                >
                  Retry
                </button>
              ) : null}
            </span>
          ) : (
            <>
              <span className="text-num text-ink-secondary">
                {file.pages ?? '—'}p
              </span>
              <span className="text-num text-ink-muted">
                {formatSize(file.size)}
              </span>
            </>
          )}
        </div>
        {isUploading ? (
          <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <span className="block h-full w-1/3 animate-[shuttle_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
          </div>
        ) : null}
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          aria-label={`Remove ${file.name} from queue`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-ink-muted transition-colors duration-fast hover:text-danger"
        >
          <CloseGlyph />
        </button>
      ) : (
        <span
          className="grid h-10 w-10 shrink-0 place-items-center"
          aria-hidden="true"
        >
          <CloseGlyph />
        </span>
      )}
    </div>
  );
}

export function QueueRow({
  file,
  index,
  total,
  onRemove,
  onRetry,
  isGhost = false,
}: QueueRowProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <QueueRowCard
        file={file}
        index={index}
        total={total}
        onRemove={isGhost || isDragging ? undefined : onRemove}
        onRetry={isGhost || isDragging ? undefined : onRetry}
        isGhost={isGhost || isDragging}
        dragHandleProps={{
          ref: setActivatorNodeRef,
          ...attributes,
          ...listeners,
        }}
      />
    </li>
  );
}

function GripGlyph(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      {[4, 8, 12].map((y) =>
        [5, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />)
      )}
    </svg>
  );
}

function CloseGlyph(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
