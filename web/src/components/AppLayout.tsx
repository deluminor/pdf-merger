import type { PropsWithChildren } from 'react';

export function AppLayout({ children }: PropsWithChildren): JSX.Element {
  return (
    <div className="min-h-screen bg-paper px-5 py-12 sm:px-12">
      <main className="mx-auto w-full max-w-[760px]">
        <header className="rounded-xl bg-surface px-6 py-8 shadow-sm sm:px-10">
          <p className="text-label uppercase text-accent">PDF Atelier</p>
          <h1 className="font-display text-display mt-2 text-ink">
            Merge your documents
          </h1>
          <p className="text-body-lg mt-3 max-w-[46ch] text-ink-secondary">
            Drop, reorder, and bind PDFs into one file — right on your machine.
          </p>
        </header>

        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
