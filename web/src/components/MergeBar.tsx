import { motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE, MIN_MERGE_FILES } from '../constants/ui';
import type { MergeBarStatus } from '../types/queue';

interface MergeBarProps {
  count: number;
  status: MergeBarStatus;
  onMerge: () => void;
}

export function MergeBar({
  count,
  status,
  onMerge,
}: MergeBarProps): JSX.Element {
  const reducedMotion = useReducedMotion();
  const disabled = status === 'disabled' || count < MIN_MERGE_FILES;
  const busy = status === 'busy';

  const label = busy
    ? 'Merging…'
    : count < MIN_MERGE_FILES
      ? 'Add at least 2 PDFs to merge'
      : `Merge ${count} PDFs`;

  return (
    <motion.div
      initial={{ y: reducedMotion ? 0 : 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: reducedMotion ? 0 : 16, opacity: 0 }}
      transition={{
        duration: reducedMotion ? 0.12 : DURATION.base,
        ease: EASE.outQuart,
      }}
      className="sticky bottom-6 z-20 mt-6"
    >
      <div className="rounded-xl bg-surface p-2 shadow-lg">
        <button
          type="button"
          onClick={onMerge}
          disabled={disabled || busy}
          aria-busy={busy}
          className={[
            'relative w-full overflow-hidden rounded-md px-6 py-3.5 text-title text-surface transition-colors duration-fast ease-out-quart',
            disabled
              ? 'cursor-not-allowed bg-surface-sunken text-ink-secondary'
              : 'bg-accent hover:bg-accent-hover active:bg-accent-active',
          ].join(' ')}
        >
          {busy && !reducedMotion ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-accent via-accent-active to-accent"
            />
          ) : null}
          <span className="relative">{label}</span>
        </button>
      </div>
    </motion.div>
  );
}
