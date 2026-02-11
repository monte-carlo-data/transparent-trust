export interface ReferenceUrl {
  id: string;
  url: string;
  title: string | null; // User-friendly name like "Trust Center" or "Security Whitepaper"
  description?: string | null; // Optional description of what this URL contains
  categories: string[]; // Uses same categories as Skills
  addedAt: string;
  lastUsedAt?: string | null;
  usageCount: number;
  // Unified Knowledge Pipeline fields
  isReferenceOnly?: boolean; // True if saved as reference without skill conversion
  // Skill relationship (via SkillSource join table)
  skillCount?: number; // Number of skills using this URL
}
