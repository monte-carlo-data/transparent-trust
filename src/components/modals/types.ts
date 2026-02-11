export type ModalVariant = "danger" | "warning" | "default" | "success";

export const variantColors: Record<ModalVariant, string> = {
  danger: "#dc2626",
  warning: "#f59e0b",
  default: "var(--info)",
  success: "var(--success)",
};

export const variantButtonClasses: Record<ModalVariant, string> = {
  danger: "bg-red-600 hover:bg-red-700",
  warning: "bg-amber-500 hover:bg-amber-600",
  default: "bg-blue-500 hover:bg-blue-600",
  success: "bg-green-600 hover:bg-green-700",
};
