import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { usePdfSession } from './hooks/usePdfSession';

vi.mock('./hooks/usePdfSession', () => ({ usePdfSession: vi.fn() }));
vi.mock('./components/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock('./components/Dropzone', () => ({ Dropzone: () => <div /> }));
vi.mock('./components/PdfQueue', () => ({ PdfQueue: () => <div /> }));
vi.mock('./components/MergeBar', () => ({ MergeBar: () => <div /> }));

const session = {
  sessionId: 'session-1',
  files: [],
  state: 'success' as const,
  result: {
    downloadUrl: '/api/session/session-1/download',
    totalPages: 3,
    fileSizeMb: 0.5,
    skipped: ['corrupt.pdf'],
  },
  message: undefined,
  addFiles: vi.fn(),
  retry: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
  merge: vi.fn(),
  reset: vi.fn(),
};

describe('App', () => {
  it('shows skipped filenames returned by a successful merge', () => {
    vi.mocked(usePdfSession).mockReturnValue(session);
    render(<App />);
    expect(screen.getByRole('status').textContent).toContain(
      "1 file couldn't be read and was left out: corrupt.pdf."
    );
  });
});
