/**
 * Related Skills Section Component
 *
 * Base component for displaying related skills with links.
 * Specialized by each library with library-specific links.
 */

import Link from 'next/link';
import { ReactNode } from 'react';

interface RelatedSkill {
  id: string;
  title: string;
  slug: string | null;
  summary?: string | null;
}

interface RelatedSkillsSectionProps {
  title: string;
  skills: RelatedSkill[];
  linkHref: (skill: RelatedSkill) => string;
  icon?: ReactNode;
  emptyMessage?: string;
}

export function RelatedSkillsSection({
  title,
  skills,
  linkHref,
  icon,
}: RelatedSkillsSectionProps) {
  if (skills.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <ul className="space-y-2">
        {skills.map((skill) => (
          <li key={skill.id}>
            <Link href={linkHref(skill)} className="text-sm text-blue-600 hover:underline">
              {skill.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
