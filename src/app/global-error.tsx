"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "40px",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
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
              Application Error
            </h2>
            <p
              style={{
                color: "var(--destructive)",
                fontSize: "14px",
                margin: "0 0 24px 0",
                lineHeight: 1.5,
              }}
            >
              A critical error occurred. Please refresh the page or try again later.
            </p>
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
      </body>
    </html>
  );
}
