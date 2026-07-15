import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueueRowCard } from './QueueRow';

const failedFile = {
  id: 'file-1',
  name: 'failed.pdf',
  size: 10,
  pages: null,
  status: 'error' as const,
  error: 'Upload failed',
};

describe('QueueRowCard', () => {
  it('retries errors inline', () => {
    const onRetry = vi.fn();
    render(
      <QueueRowCard file={failedFile} index={1} total={1} onRetry={onRetry} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledWith('file-1');
  });
});
