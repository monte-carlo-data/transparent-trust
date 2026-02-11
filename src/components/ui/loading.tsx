"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * InlineLoader - For buttons and inline loading states
 * Uses Loader2 icon with animate-spin
 */
type InlineLoaderProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

export function InlineLoader({ size = "md", className }: InlineLoaderProps) {
  return (
    <Loader2 className={cn("animate-spin", sizeMap[size], className)} />
  );
}

/**
 * PageLoader - Full page or section loading state
 * Centered spinner with optional message
 */
type PageLoaderProps = {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function PageLoader({ message, size = "lg", className }: PageLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <InlineLoader size={size} className="text-muted-foreground mb-2" />
      {message && (
        <span className="text-sm text-muted-foreground">{message}</span>
      )}
    </div>
  );
}

/**
 * CardLoader - Loading state styled as a card (matches LoadingSpinner)
 * For multi-step workflows and long-running operations
 */
type CardLoaderProps = {
  title: string;
  subtitle?: string;
};

export function CardLoader({ title, subtitle }: CardLoaderProps) {
  return (
    <>
      <style>
        {`
          @keyframes cardLoaderSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div
        style={{
          marginTop: "16px",
          padding: "16px",
          backgroundColor: "#eff6ff",
          border: "2px solid #60a5fa",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            border: "3px solid #e0e7ff",
            borderTop: "3px solid #2563eb",
            borderRadius: "50%",
            animation: "cardLoaderSpin 1s linear infinite",
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: subtitle ? "4px" : 0 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: "14px", color: "#60a5fa" }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * ButtonLoader - Loading state for buttons
 * Shows spinner + optional text, maintains button width
 */
type ButtonLoaderProps = {
  text?: string;
  size?: "sm" | "md";
};

export function ButtonLoader({ text = "Loading...", size = "sm" }: ButtonLoaderProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <InlineLoader size={size} />
      {text}
    </span>
  );
}
