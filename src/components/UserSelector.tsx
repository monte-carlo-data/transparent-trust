"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

export type SelectableUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type Props = {
  onSelect: (user: SelectableUser) => void;
  onCancel: () => void;
  excludeUserIds?: string[]; // Users to exclude (already assigned)
  placeholder?: string;
  disabled?: boolean;
};

export default function UserSelector({
  onSelect,
  onCancel,
  excludeUserIds = [],
  placeholder = "Search users...",
  disabled = false,
}: Props) {
  const [users, setUsers] = useState<SelectableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const result = await response.json();
        // Handle both { data: { users: [...] } } and { users: [...] } formats
        const data = result.data || result;
        setUsers(data.users || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Filter users based on search and exclusions
  const filteredUsers = users.filter((user) => {
    // Exclude already assigned users
    if (excludeUserIds.includes(user.id)) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = user.name?.toLowerCase().includes(query);
      const matchesEmail = user.email?.toLowerCase().includes(query);
      return matchesName || matchesEmail;
    }

    return true;
  });

  const handleSelect = (user: SelectableUser) => {
    onSelect(user);
    setIsOpen(false);
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "?";
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        overflow: "hidden",
      }}
    >
      {/* Search input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
        }}
      >
        <Search size={16} style={{ color: "#64748b" }} />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || loading}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            backgroundColor: "transparent",
            fontSize: "0.9rem",
          }}
        />
        <button
          onClick={onCancel}
          style={{
            padding: "4px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* User list */}
      <div
        style={{
          maxHeight: "250px",
          overflowY: "auto",
        }}
      >
        {loading && (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "0.9rem",
            }}
          >
            Loading users...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: "#dc2626",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && filteredUsers.length === 0 && (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "0.9rem",
            }}
          >
            {searchQuery
              ? "No users match your search"
              : users.length === excludeUserIds.length
              ? "All users are already assigned"
              : "No users available"}
          </div>
        )}

        {!loading &&
          !error &&
          filteredUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              disabled={disabled}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                border: "none",
                borderBottom: "1px solid #f1f5f9",
                backgroundColor: "transparent",
                cursor: disabled ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = "#f0f9ff";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {/* Avatar */}
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "#e0f2fe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0369a1",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                  }}
                >
                  {getInitials(user.name, user.email)}
                </div>
              )}

              {/* Name and email */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: "0.9rem",
                    color: "#1e293b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.name || "Unnamed User"}
                </div>
                {user.email && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user.email}
                  </div>
                )}
              </div>
            </button>
          ))}
      </div>

      {/* Help text */}
      <div
        style={{
          padding: "8px 12px",
          backgroundColor: "#f8fafc",
          borderTop: "1px solid #e2e8f0",
          fontSize: "0.75rem",
          color: "#94a3b8",
        }}
      >
        Select a team member to assign as owner
      </div>
    </div>
  );
}
