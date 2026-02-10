"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { InlineError } from "@/components/ui/status-display";

// Force dynamic rendering to ensure middleware runs
export const dynamic = 'force-dynamic';

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--surface-secondary)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    backgroundColor: "#fff",
    padding: "48px",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    textAlign: "center" as const,
    maxWidth: "400px",
    width: "100%",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    marginBottom: "8px",
    color: "var(--text-heading)",
  },
  subtitle: {
    color: "var(--muted-foreground)",
    marginBottom: "32px",
  },
  button: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    width: "100%",
    padding: "12px 24px",
    backgroundColor: "#fff",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  };

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const iss = searchParams.get("iss");
  const [devEmail, setDevEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRedirecting, setAutoRedirecting] = useState(false);

  // Auto-redirect to Okta if iss parameter is present (Okta initiated login)
  useEffect(() => {
    if (iss && !error && !autoRedirecting) {
      // Use a microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setAutoRedirecting(true);
        // Determine provider based on issuer domain
        const provider = iss.includes("okta.com") ? "okta" : "google";
        signIn(provider, { callbackUrl });
      });
    }
  }, [iss, error, callbackUrl, autoRedirecting]);

  if (autoRedirecting) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Redirecting to SSO...</h1>
          <p style={styles.subtitle}>Please wait</p>
        </div>
      </div>
    );
  }

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devEmail) return;
    setLoading(true);
    await signIn("credentials", { email: devEmail, callbackUrl });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Transparent Trust</h1>
        <p style={styles.subtitle}>Sign in to continue</p>

        {error && (
          <InlineError
            message={
              error === "OAuthAccountNotLinked"
                ? "This email is already associated with another account."
                : error === "CredentialsSignin"
                ? "Invalid credentials."
                : error === "OAuthCallback"
                ? "OAuth callback error. Check server logs."
                : error === "OAuthSignin"
                ? "OAuth sign-in error. Check Google OAuth config."
                : `Sign in error: ${error}`
            }
          />
        )}

        {/* Dev Login - only shown in development */}
        <form onSubmit={handleDevLogin} style={{ marginBottom: "24px" }}>
          <input
            type="email"
            placeholder="dev@example.com"
            value={devEmail}
            onChange={(e) => setDevEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "16px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            disabled={loading || !devEmail}
            style={{
              ...styles.button,
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              opacity: loading || !devEmail ? 0.6 : 1,
            }}
          >
            {loading ? "Signing in..." : "Dev Login (any email)"}
          </button>
          <p style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "8px" }}>
            First user becomes admin automatically
          </p>
        </form>

        <div style={{
          borderTop: "1px solid var(--border)",
          paddingTop: "24px",
          marginTop: "8px",
        }}>
          <p style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "12px" }}>
            Or use SSO (requires config)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              onClick={() => signIn("okta", { callbackUrl })}
              style={styles.button}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface-secondary)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#007DC1"
                  d="M12 0C5.389 0 0 5.389 0 12s5.389 12 12 12 12-5.389 12-12S18.611 0 12 0zm0 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z"
                />
              </svg>
              Continue with Okta
            </button>
            <button
              onClick={() => signIn("google", { callbackUrl })}
              style={styles.button}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface-secondary)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
          </div>
          <Link
            href="/setup"
            style={{
              display: "block",
              textAlign: "center",
              marginTop: "16px",
              fontSize: "13px",
              color: "#3b82f6",
              textDecoration: "none",
            }}
          >
            Need to configure SSO? Run setup wizard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={styles.container}>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}
