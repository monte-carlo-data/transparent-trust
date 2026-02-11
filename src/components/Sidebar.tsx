"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useBranding } from "@/lib/branding";
import { features } from "@/lib/featureFlags";
import { isUserAdmin, type SessionUser } from "@/lib/auth-v2";
import ReviewInbox from "./ReviewInbox";
import { ThemeToggle } from "./ThemeToggle";
import { useEffect, useState } from "react";
import type { LibraryId } from "@/types/v2";

type NavItem = {
  href: string;
  label: string;
  hint?: string;
  adminOnly?: boolean;
  featureFlag?: keyof typeof features;
};

type NavSection = {
  section: string;
  items: NavItem[];
  adminOnly?: boolean;
  featureFlag?: keyof typeof features;
};

const navItems: NavSection[] = [
  {
    section: "Home",
    items: [
      { href: "/v2", label: "Dashboard", hint: "Overview & activity" },
    ],
  },
  {
    section: "Tools",
    items: [
      { href: "/v2/chat", label: "Chat", hint: "AI conversations" },
      { href: "/v2/rfps", label: "RFPs", hint: "Answer questions & bulk upload" },
      { href: "/v2/collateral", label: "Collateral", hint: "Generate documents" },
      { href: "/v2/contracts", label: "Contracts", hint: "Contract reviews" },
    ],
  },
  {
    section: "Libraries",
    items: [
      { href: "/v2/knowledge", label: "Knowledge", hint: "General skills" },
      { href: "/v2/it", label: "IT", hint: "IT knowledge" },
      { href: "/v2/gtm", label: "GTM", hint: "Sales & marketing knowledge" },
      { href: "/v2/talent", label: "Talent", hint: "Recruiting & hiring" },
      { href: "/v2/customers", label: "Customers", hint: "Customer profiles" },
    ],
  },
  {
    section: "Administration",
    adminOnly: true,
    items: [
      { href: "/v2/admin", label: "Admin Dashboard", hint: "Overview & stats" },
      { href: "/v2/prompt-registry", label: "Prompt Registry", hint: "System prompts & blocks" },
      { href: "/v2/content", label: "Content Assets", hint: "Personas & templates" },
      { href: "/v2/accuracy", label: "Accuracy & Metrics", hint: "Performance tracking" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { branding } = useBranding();
  const [accessibleLibraries, setAccessibleLibraries] = useState<LibraryId[] | null>(null);

  // Check for admin access (via team membership or session flag)
  const isAdmin = isUserAdmin(session?.user as SessionUser);

  // Fetch user's accessible libraries
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    const controller = new AbortController();

    fetch('/api/user/libraries', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setAccessibleLibraries(data.libraries || []);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Failed to fetch accessible libraries:', error);
          setAccessibleLibraries([]);
        }
      });

    return () => controller.abort();
  }, [session?.user?.id]);

  // Libraries are still loading if we have a session but haven't fetched yet
  const librariesLoading = session?.user?.id && accessibleLibraries === null;

  // Filter nav items based on user role and feature flags
  const visibleNavItems = navItems.map((section) => {
    // Check admin-only at section level
    if (section.adminOnly && !isAdmin) return null;
    // Check feature flag at section level
    if (section.featureFlag && !features[section.featureFlag]) return null;

    // For Libraries section, filter items based on accessible libraries
    // (only filter after loading completes to avoid flashing content)
    if (section.section === "Libraries" && !librariesLoading && accessibleLibraries) {
      const filteredItems = section.items.filter((item) => {
        // Map library links to library IDs
        const libraryIdMap: Record<string, LibraryId> = {
          "/v2/knowledge": "knowledge",
          "/v2/it": "it",
          "/v2/gtm": "gtm",
          "/v2/talent": "talent",
          "/v2/customers": "customers",
        };
        const libraryId = libraryIdMap[item.href];
        // Show library only if user has access
        return !libraryId || accessibleLibraries.includes(libraryId);
      });
      return { ...section, items: filteredItems };
    }

    return section;
  }).filter((section): section is typeof navItems[0] => section !== null);

  return (
    <aside style={{
      position: "fixed",
      left: 0,
      top: 0,
      bottom: 0,
      width: "240px",
      backgroundColor: "var(--sidebar-background)",
      color: "var(--sidebar-foreground)",
      padding: "24px 0",
      overflowY: "auto",
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ padding: "0 20px", marginBottom: "32px" }}>
        <Link href="/" style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--sidebar-foreground)",
          textDecoration: "none",
          display: "block",
        }}>
          {branding.appName}
        </Link>
        <p style={{
          fontSize: "12px",
          color: "var(--sidebar-muted)",
          marginTop: "4px",
          marginBottom: 0,
        }}>
          {branding.sidebarSubtitle}
        </p>
      </div>

      <nav style={{ flex: 1 }}>
        {visibleNavItems.map((section) => (
          <div key={section.section} style={{ marginBottom: "24px" }}>
            <div style={{
              padding: "0 20px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--sidebar-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "8px",
            }}>
              {section.section}
            </div>
            {section.items
              .filter((item) => {
                if (item.adminOnly && !isAdmin) return false;
                if (item.featureFlag && !features[item.featureFlag]) return false;
                return true;
              })
              .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "block",
                    padding: item.hint ? "8px 20px 10px" : "10px 20px",
                    color: isActive ? "var(--sidebar-foreground)" : "var(--sidebar-muted)",
                    backgroundColor: isActive ? "var(--sidebar-active)" : "transparent",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: isActive ? 600 : 400,
                    borderLeft: isActive ? `3px solid ${branding.primaryColor}` : "3px solid transparent",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "var(--sidebar-hover)";
                      e.currentTarget.style.color = "var(--sidebar-foreground)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--sidebar-muted)";
                    }
                  }}
                >
                  <span>{item.label}</span>
                  {item.hint && (
                    <span style={{
                      display: "block",
                      fontSize: "11px",
                      color: "var(--sidebar-muted)",
                      marginTop: "2px",
                    }}>
                      {item.hint}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Review Inbox */}
      <div style={{
        padding: "0",
        marginBottom: "16px",
      }}>
        <div style={{
          padding: "0 20px",
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--sidebar-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "8px",
        }}>
          Reviews
        </div>
        <ReviewInbox />
      </div>

      {/* User section at bottom */}
      <div style={{
        padding: "16px 20px",
        borderTop: `1px solid var(--sidebar-border)`,
        marginTop: "auto",
      }}>
        {status === "loading" ? (
          <div style={{ color: "var(--sidebar-muted)", fontSize: "13px" }}>Loading...</div>
        ) : session?.user ? (
          <div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
            }}>
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt=""
                  width={32}
                  height={32}
                  style={{
                    borderRadius: "50%",
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--sidebar-foreground)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {session.user.name}
                </div>
                <div style={{
                  fontSize: "11px",
                  color: "var(--sidebar-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {session.user.email}
                </div>
              </div>
            </div>
            <div style={{
              marginBottom: "12px",
            }}>
              <p style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--sidebar-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}>
                Theme
              </p>
              <ThemeToggle />
            </div>
            <button
              onClick={() => signOut()}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "transparent",
                border: `1px solid var(--sidebar-border)`,
                borderRadius: "6px",
                color: "var(--sidebar-muted)",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn()}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: branding.primaryColor,
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Sign in
          </button>
        )}
      </div>
    </aside>
  );
}
