"use client";

import { useEffect, useRef } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const autoRetried = useRef(false);

  useEffect(() => {
    console.error(error);
    if (!autoRetried.current) {
      autoRetried.current = true;
      const t = setTimeout(() => unstable_retry(), 600);
      return () => clearTimeout(t);
    }
  }, [error, unstable_retry]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          color: "#0f172a",
          background: "#fff",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: 600, margin: "16px 0 4px" }}>
          This page couldn’t load
        </h2>
        <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
          A temporary connection issue interrupted the app. Try again.
        </p>
        <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
          <button
            onClick={() => unstable_retry()}
            style={{
              background: "#0f172a",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#fff",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
