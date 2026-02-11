"use client";

import { CSSProperties } from "react";

export type Domain = "technical" | "legal" | "security";

type DomainSelectorProps = {
  selectedDomains: Domain[];
  onChange: (domains: Domain[]) => void;
  disabled?: boolean;
  style?: CSSProperties;
};

const domainConfig: { id: Domain; label: string; icon: string; color: string; bgColor: string }[] = [
  { id: "technical", label: "Technical", icon: "⚙️", color: "#0369a1", bgColor: "#e0f2fe" },
  { id: "legal", label: "Legal", icon: "⚖️", color: "#7c3aed", bgColor: "#ede9fe" },
  { id: "security", label: "Security", icon: "🔒", color: "#b45309", bgColor: "#fef3c7" },
];

export default function DomainSelector({
  selectedDomains,
  onChange,
  disabled = false,
  style,
}: DomainSelectorProps) {
  const toggleDomain = (domain: Domain) => {
    if (disabled) return;
    if (selectedDomains.includes(domain)) {
      onChange(selectedDomains.filter((d) => d !== domain));
    } else {
      onChange([...selectedDomains, domain]);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        ...style,
      }}
    >
      <span style={{ fontSize: "0.85rem", color: "#64748b", marginRight: "4px" }}>
        Focus:
      </span>
      {domainConfig.map((domain) => {
        const isSelected = selectedDomains.includes(domain.id);
        return (
          <button
            key={domain.id}
            type="button"
            onClick={() => toggleDomain(domain.id)}
            disabled={disabled}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              borderRadius: "16px",
              border: `1px solid ${isSelected ? domain.color : "#e2e8f0"}`,
              backgroundColor: isSelected ? domain.bgColor : "var(--card)",
              color: isSelected ? domain.color : "#64748b",
              fontSize: "0.8rem",
              fontWeight: isSelected ? 600 : 400,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              transition: "all 0.15s ease",
            }}
          >
            <span>{domain.icon}</span>
            <span>{domain.label}</span>
          </button>
        );
      })}
      {selectedDomains.length === 0 && (
        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>
          (general)
        </span>
      )}
    </div>
  );
}
