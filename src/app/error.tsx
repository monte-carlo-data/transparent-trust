"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "40px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--destructive-bg)",
          border: "1px solid var(--destructive-border)",
          borderRadius: "12px",
          padding: "32px 48px",
          maxWidth: "500px",
        }}
      >
        <h2
          style={{
            color: "var(--destructive)",
            fontSize: "24px",
            fontWeight: 600,
            margin: "0 0 12px 0",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            color: "var(--destructive)",
            fontSize: "14px",
            margin: "0 0 24px 0",
            lineHeight: 1.5,
          }}
        >
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              backgroundColor: "var(--destructive)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#fff",
              color: "var(--text-heading)",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Go home
          </button>
        </div>
        {error.digest && (
          <p
            style={{
              color: "var(--muted-foreground)",
              fontSize: "11px",
              marginTop: "16px",
              fontFamily: "monospace",
            }}
          >
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
