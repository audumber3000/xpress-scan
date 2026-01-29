'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { colors } from '@/lib/seo';

type BookDemoContextType = {
  openDemoModal: () => void;
};

const BookDemoContext = createContext<BookDemoContextType | null>(null);

export function useBookDemoModal() {
  const ctx = useContext(BookDemoContext);
  if (!ctx) throw new Error('useBookDemoModal must be used within BookDemoProvider');
  return ctx;
}

export function BookDemoProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDemoModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <BookDemoContext.Provider value={{ openDemoModal }}>
      {children}
      {open && (
        <BookDemoModalContent onClose={closeModal} />
      )}
    </BookDemoContext.Provider>
  );
}

function BookDemoModalContent({ onClose }: { onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem('demo-name') as HTMLInputElement)?.value;
    const phone = (form.elements.namedItem('demo-phone') as HTMLInputElement)?.value;
    const email = (form.elements.namedItem('demo-email') as HTMLInputElement)?.value;
    setLoading(true);
    // Optional: send to API; for now just show thank you
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-demo-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 sm:p-8 book-demo-modal-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <p className="text-lg font-semibold text-gray-900 mb-2">Thank you!</p>
            <p className="text-gray-600">We&apos;ll reach out shortly to schedule your demo.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 px-6 py-2 rounded-lg font-medium text-white"
              style={{ backgroundColor: colors.primary }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 id="book-demo-title" className="text-xl font-bold text-gray-900 mb-1">
              Book a Demo
            </h2>
            <p className="text-gray-600 text-sm mb-6">Fill in your details and we&apos;ll get in touch.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="demo-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  id="demo-name"
                  name="demo-name"
                  type="text"
                  required
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                />
              </div>
              <div>
                <label htmlFor="demo-phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  id="demo-phone"
                  name="demo-phone"
                  type="tel"
                  required
                  placeholder="Phone number"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                />
              </div>
              <div>
                <label htmlFor="demo-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="demo-email"
                  name="demo-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white disabled:opacity-70"
                  style={{ backgroundColor: colors.primary }}
                >
                  {loading ? 'Sending…' : 'Submit'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function BookDemoButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { openDemoModal } = useBookDemoModal();
  return (
    <button type="button" onClick={openDemoModal} className={className}>
      {children}
    </button>
  );
}
