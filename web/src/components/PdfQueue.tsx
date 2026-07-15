import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import { DRAG_ACTIVATION_DISTANCE, formatSize } from '../constants/ui';
import type { QueuedFile } from '../types/queue';
import { Dropzone } from './Dropzone';
import { QueueRow, QueueRowCard } from './QueueRow';

interface PdfQueueProps {
  files: QueuedFile[];
  onReorder: (orderedIds: string[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onClear: () => void;
  onAddFiles: (files: File[]) => void;
  disabled?: boolean;
}

const dropAnimation: DropAnimation = {
  duration: 240,
  easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
};

function previewIndex(
  fileId: string,
  ids: string[],
  activeId: UniqueIdentifier | null,
  overId: UniqueIdentifier | null
): number {
  if (activeId === null || overId === null) return ids.indexOf(fileId) + 1;
  const oldIndex = ids.indexOf(String(activeId));
  const newIndex = ids.indexOf(String(overId));
  if (oldIndex < 0 || newIndex < 0) return ids.indexOf(fileId) + 1;
  return arrayMove(ids, oldIndex, newIndex).indexOf(fileId) + 1;
}

export function PdfQueue({
  files,
  onReorder,
  onRemove,
  onRetry,
  onClear,
  onAddFiles,
  disabled,
}: PdfQueueProps): JSX.Element {
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => files.map((f) => f.id), [files]);
  const totals = useMemo(() => {
    const pages = files.reduce((sum, f) => sum + (f.pages ?? 0), 0);
    const bytes = files.reduce((sum, f) => sum + f.size, 0);
    return { pages, size: formatSize(bytes) };
  }, [files]);

  const activeFile =
    activeId === null ? undefined : files.find((f) => f.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
    setOverId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  const nameOf = (id: string): string =>
    files.find((f) => f.id === id)?.name ?? 'file';
  const livePosition = (id: string): number =>
    previewIndex(id, ids, activeId, overId);

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(String(active.id))}. Position ${livePosition(String(active.id))} of ${files.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(String(active.id))} moved to position ${previewIndex(String(active.id), ids, active.id, over.id)} of ${files.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(String(active.id))} dropped at position ${previewIndex(String(active.id), ids, active.id, over.id)} of ${files.length}.`
        : `${nameOf(String(active.id))} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${nameOf(String(active.id))} returned to position ${ids.indexOf(String(active.id)) + 1} of ${files.length}.`,
  };

  return (
    <section className="rounded-lg bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-label uppercase text-ink-muted">
          Queue · {files.length} files · {totals.pages} pages · {totals.size}
        </p>
        {confirmClear ? (
          <span className="flex items-center gap-2 text-caption text-ink-secondary">
            Clear all {files.length} files?
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="rounded-sm px-2 py-1 text-ink-secondary transition-colors duration-fast hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmClear(false);
                onClear();
              }}
              className="rounded-sm px-2 py-1 font-medium text-danger transition-colors duration-fast hover:bg-danger-soft"
            >
              Clear
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={disabled}
            className="rounded-sm px-2 py-1 text-caption text-ink-muted transition-colors duration-fast hover:text-danger disabled:opacity-40"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="mb-3">
        <Dropzone variant="bar" disabled={disabled} onFiles={onAddFiles} />
      </div>

      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul
            className={`flex flex-col gap-2 ${disabled ? 'pointer-events-none opacity-60' : ''}`}
          >
            {files.map((file) => (
              <QueueRow
                key={file.id}
                file={file}
                index={previewIndex(file.id, ids, activeId, overId)}
                total={files.length}
                onRemove={onRemove}
                onRetry={onRetry}
                isGhost={file.id === activeId}
              />
            ))}
          </ul>
        </SortableContext>

        <DragOverlay adjustScale={false} dropAnimation={dropAnimation}>
          {activeFile ? (
            <QueueRowCard
              file={activeFile}
              index={previewIndex(activeFile.id, ids, activeId, overId)}
              total={files.length}
              elevated
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
