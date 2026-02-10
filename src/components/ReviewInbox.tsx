"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface ReviewCounts {
  pending: number;
  approved: number;
  corrected: number;
}

const styles = {
  container: {
    position: "relative" as const,
  },
  badge: {
    position: "absolute" as const,
    top: "-4px",
    right: "-4px",
    backgroundColor: "var(--destructive)",
    color: "var(--card)",
    fontSize: "10px",
    fontWeight: 700,
    borderRadius: "999px",
    minWidth: "16px",
    height: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
  link: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    color: "var(--sidebar-muted)",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    width: "100%",
    textAlign: "left" as const,
    borderLeft: "3px solid transparent",
    textDecoration: "none",
  },
};

export default function ReviewInbox() {
  useSession();
  const [counts] = useState<ReviewCounts>({ pending: 0, approved: 0, corrected: 0 });

  return (
    <div style={styles.container}>
      <Link
        href="/v2/reviews"
        style={styles.link}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--sidebar-active)";
          e.currentTarget.style.color = "var(--sidebar-foreground)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--sidebar-muted)";
        }}
      >
        <span style={{ position: "relative" }}>
          Review Inbox
          {counts.pending > 0 && (
            <span style={styles.badge}>{counts.pending > 99 ? "99+" : counts.pending}</span>
          )}
        </span>
      </Link>
    </div>
  );
}

// Compact badge-only version for the sidebar nav
export function ReviewBadge() {
  useSession();
  const [count] = useState(0);

  if (count === 0) return null;

  return (
    <span style={{
      backgroundColor: "var(--destructive)",
      color: "var(--card)",
      fontSize: "10px",
      fontWeight: 700,
      borderRadius: "999px",
      minWidth: "18px",
      height: "18px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 5px",
      marginLeft: "8px",
    }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
