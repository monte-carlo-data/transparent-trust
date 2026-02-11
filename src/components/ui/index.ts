// Centralized exports for UI components
// This allows importing from "@/components/ui" instead of individual files

// Core UI components
export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";

export { Badge, badgeVariants } from "./badge";
export type { BadgeProps } from "./badge";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card";

export { Input } from "./input";

export { Textarea } from "./textarea";

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

// Dialog (Radix UI based)
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

// Tooltip
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

// Modal variants and colors (exported from ConfirmModal)
export { variantColors } from "../ConfirmModal";
export type { ModalVariant } from "../ConfirmModal";

// Loading states
export {
  InlineLoader,
  PageLoader,
  CardLoader,
  ButtonLoader,
} from "./loading";

// Status displays
export {
  StatusDisplay,
  ErrorDisplay,
  SuccessDisplay,
  WarningDisplay,
  InfoDisplay,
  InlineError,
  InlineSuccess,
  statusStyles,
  statusInlineStyles,
} from "./status-display";

// Specialized components
export { ResizableDivider } from "./resizable-divider";
export { ConversationalPanel } from "./conversational-panel";
export type { Message, TextareaSize, ConversationalPanelProps } from "./conversational-panel";
