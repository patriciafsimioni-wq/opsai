"use client";

import { useEffect, useRef, useState } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const autoRetried = useRef(false);
  const [retrying, setRetrying] = useState(true);

  useEffect(() => {
    console.error(error);
    // The cause is usually a transient backend/database hiccup — retry once
    // automatically (re-fetches + re-renders the segment, no full reload).
    if (!autoRetried.current) {
      autoRetried.current = true;
      const t = setTimeout(() => unstable_retry(), 600);
      return () => clearTimeout(t);
    }
    setRetrying(false);
  }, [error, unstable_retry]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 text-slate-600">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h2 className="mt-4 text-xl font-semibold text-slate-900">
        {retrying ? "Loading…" : "This page couldn’t load"}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {retrying
          ? "Reconnecting to the server."
          : "A temporary connection issue interrupted the page. Try again."}
      </p>
      {!retrying && (
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => {
              setRetrying(true);
              unstable_retry();
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
