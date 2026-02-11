"use client";

import { ReactNode } from "react";
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared status display styles using semantic CSS variables
 * These classes use the CSS variables defined in globals.css
 */
export const statusStyles = {
  error: {
    container: "bg-destructive-bg border-destructive-border text-destructive-text",
    icon: "text-destructive",
    title: "text-destructive-text",
    message: "text-destructive-text",
  },
  success: {
    container: "bg-success-bg border-success-border text-success-text",
    icon: "text-success",
    title: "text-success-text",
    message: "text-success-text",
  },
  warning: {
    container: "bg-warning-bg border-warning-border text-warning-text",
    icon: "text-warning",
    title: "text-warning-text",
    message: "text-warning-text",
  },
  info: {
    container: "bg-info-bg border-info-border text-info-text",
    icon: "text-info",
    title: "text-info-text",
    message: "text-info-text",
  },
};

/**
 * Inline styles for components not using Tailwind
 * Using CSS variables for theme-aware colors
 */
export const statusInlineStyles = {
  error: {
    backgroundColor: "var(--destructive-bg)",
    color: "var(--destructive-text)",
    border: "1px solid var(--destructive-border)",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  success: {
    backgroundColor: "var(--success-bg)",
    color: "var(--success-text)",
    border: "1px solid var(--success-border)",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  warning: {
    backgroundColor: "var(--warning-bg)",
    color: "var(--warning-text)",
    border: "1px solid var(--warning-border)",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  info: {
    backgroundColor: "var(--info-bg)",
    color: "var(--info-text)",
    border: "1px solid var(--info-border)",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
};

type StatusVariant = "error" | "success" | "warning" | "info";

const variantIcons: Record<StatusVariant, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

/**
 * StatusDisplay - Unified component for error, success, warning, info messages
 */
type StatusDisplayProps = {
  variant: StatusVariant;
  title?: string;
  message: string | ReactNode;
  onDismiss?: () => void;
  className?: string;
  showIcon?: boolean;
};

export function StatusDisplay({
  variant,
  title,
  message,
  onDismiss,
  className,
  showIcon = true,
}: StatusDisplayProps) {
  const styles = statusStyles[variant];
  const Icon = variantIcons[variant];

  return (
    <div
      className={cn(
        "border rounded-md p-3 flex items-start gap-3",
        styles.container,
        className
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      {showIcon && (
        <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", styles.icon)} />
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <div className={cn("font-semibold text-sm mb-1", styles.title)}>
            {title}
          </div>
        )}
        <div className={cn("text-sm", styles.message)}>{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn(
            "flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors",
            styles.icon
          )}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * ErrorDisplay - Convenience wrapper for error variant
 */
type ErrorDisplayProps = Omit<StatusDisplayProps, "variant">;

export function ErrorDisplay(props: ErrorDisplayProps) {
  return <StatusDisplay variant="error" {...props} />;
}

/**
 * SuccessDisplay - Convenience wrapper for success variant
 */
type SuccessDisplayProps = Omit<StatusDisplayProps, "variant">;

export function SuccessDisplay(props: SuccessDisplayProps) {
  return <StatusDisplay variant="success" {...props} />;
}

/**
 * WarningDisplay - Convenience wrapper for warning variant
 */
type WarningDisplayProps = Omit<StatusDisplayProps, "variant">;

export function WarningDisplay(props: WarningDisplayProps) {
  return <StatusDisplay variant="warning" {...props} />;
}

/**
 * InfoDisplay - Convenience wrapper for info variant
 */
type InfoDisplayProps = Omit<StatusDisplayProps, "variant">;

export function InfoDisplay(props: InfoDisplayProps) {
  return <StatusDisplay variant="info" {...props} />;
}

/**
 * InlineError - Simple inline error for forms (styled div, no Tailwind)
 * Use for compatibility with existing inline-styled components
 */
type InlineStatusProps = {
  message: string;
  onDismiss?: () => void;
};

export function InlineError({ message, onDismiss }: InlineStatusProps) {
  return (
    <div style={statusInlineStyles.error}>
      {message}
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            marginLeft: "12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            textDecoration: "underline",
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function InlineSuccess({ message, onDismiss }: InlineStatusProps) {
  return (
    <div style={statusInlineStyles.success}>
      {message}
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            marginLeft: "12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            textDecoration: "underline",
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
