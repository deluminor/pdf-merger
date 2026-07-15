import { useCallback, useRef, useState } from 'react';
import { MAX_FILES } from '../constants/ui';

interface DropzoneProps {
  variant: 'empty' | 'bar';
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}

export function Dropzone({
  variant,
  disabled,
  onFiles,
}: DropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const pickFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const selected = Array.from(list);
      if (selected.length) onFiles(selected);
    },
    [onFiles]
  );

  const open = () => !disabled && inputRef.current?.click();

  const hidden = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf"
      multiple
      hidden
      onChange={(e) => {
        pickFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );

  const dragProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsOver(true);
    },
    onDragLeave: () => setIsOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsOver(false);
      pickFiles(e.dataTransfer.files);
    },
  };

  if (variant === 'bar') {
    return (
      <div {...dragProps}>
        {hidden}
        <button
          type="button"
          onClick={open}
          disabled={disabled}
          className={[
            'w-full rounded-md border border-dashed px-5 py-3 text-body transition-colors duration-fast ease-out-quart',
            isOver
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-hairline-strong bg-surface text-ink-secondary hover:border-hairline-strong hover:bg-surface-sunken',
          ].join(' ')}
        >
          {isOver ? 'Release to add' : '＋ Add more PDFs'}
        </button>
      </div>
    );
  }

  return (
    <div {...dragProps}>
      {hidden}
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        aria-label="Drop PDFs here or click to browse"
        className={[
          'flex min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 text-center transition-all duration-fast ease-out-quart',
          isOver
            ? 'scale-[1.01] border-accent bg-accent-soft'
            : 'border-hairline-strong bg-surface hover:border-hairline-strong hover:bg-surface-sunken',
        ].join(' ')}
      >
        <PagesGlyph className={isOver ? 'text-accent' : 'text-ink-muted'} />
        <span
          className={`font-display text-h2 ${isOver ? 'text-accent' : 'text-ink'}`}
        >
          {isOver ? 'Release to add' : 'Drop PDFs here'}
        </span>
        <span className="text-body text-ink-secondary">
          or click to browse — up to {MAX_FILES} files
        </span>
      </button>
    </div>
  );
}

function PagesGlyph({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 3h6l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v4h4" />
      <path d="M4 7v12a2 2 0 0 0 2 2h8" opacity="0.5" />
    </svg>
  );
}
