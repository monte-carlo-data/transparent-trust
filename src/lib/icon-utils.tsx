/**
 * Icon utilities for rendering icons by ID
 *
 * This module provides icon rendering functions that map icon IDs
 * to lucide-react components. Used by config-driven components that
 * need to render library-specific icons without hardcoding.
 */

import {
  BookOpen,
  Wrench,
  Target,
  Users,
  Building2,
  Code2,
  Zap,
  FileText,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Map icon IDs to lucide icon components
 */
const iconMap: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  wrench: Wrench,
  target: Target,
  users: Users,
  building: Building2,
  code: Code2,
  zap: Zap,
  'file-text': FileText,
  eye: Eye,
};

/**
 * Render an icon by ID with optional className
 */
export function renderIcon(iconId: string, className: string = ''): ReactNode {
  const IconComponent = iconMap[iconId];
  if (!IconComponent) {
    console.warn(`Unknown icon ID: ${iconId}`);
    return null;
  }
  return <IconComponent className={className} />;
}

/**
 * Get the icon component for an ID
 */
export function getIconComponent(iconId: string): LucideIcon | null {
  return iconMap[iconId] || null;
}
