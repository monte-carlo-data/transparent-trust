'use client';

/**
 * ActivityTab Component
 *
 * Displays customer activity including:
 * - RFP projects
 * - Contract reviews
 * - Chat sessions
 * - Collateral sessions
 */

import Link from 'next/link';
import { FileText, MessageSquare, FileSpreadsheet, ScrollText, Clock, CheckCircle2, AlertCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return new Date(date).toLocaleDateString();
  }
  if (diffDays > 0) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

interface ProjectActivity {
  id: string;
  name: string;
  projectType: string;
  status: string;
  rowCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatSessionActivity {
  id: string;
  title: string | null;
  sessionType: string;
  status: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ActivityTabProps {
  projects: ProjectActivity[];
  chatSessions: ChatSessionActivity[];
}

// Icon mapping by type
const PROJECT_ICONS: Record<string, LucideIcon> = {
  rfp: FileSpreadsheet,
  'contract-review': ScrollText,
};

const SESSION_ICONS: Record<string, LucideIcon> = {
  collateral: FileText,
  chat: MessageSquare,
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  rfp: 'RFP',
  'contract-review': 'Contract Review',
  bva: 'BVA',
};

function getStatusBadge(status: string): ReactNode {
  const statusConfig: Record<string, { bg: string; text: string; icon?: LucideIcon; label: string }> = {
    FINALIZED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Completed' },
    ARCHIVED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Archived' },
    IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'In Progress' },
    ACTIVE: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'Active' },
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  };

  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  );
}

// Reusable section component to reduce duplication
interface ActivitySectionProps {
  title: string;
  count: number;
  icon: LucideIcon;
  iconColor: string;
  children: ReactNode;
}

function ActivitySection({ title, count, icon: Icon, iconColor, children }: ActivitySectionProps): ReactNode {
  if (count === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {title} ({count})
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

// Reusable activity item component
interface ActivityItemProps {
  href: string;
  hoverColor: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  status: string;
  updatedAt: Date;
}

function ActivityItem({ href, hoverColor, icon: Icon, title, subtitle, status, updatedAt }: ActivityItemProps): ReactNode {
  return (
    <Link
      href={href}
      className={`block p-4 bg-white border border-gray-200 rounded-lg ${hoverColor} hover:shadow-sm transition-all`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4" />
          <div>
            <span className="font-medium text-gray-900">{title}</span>
            {subtitle && <span className="text-gray-500 ml-2 text-sm">{subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(status)}
          <span className="text-xs text-gray-500">{formatTimeAgo(updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

export function ActivityTab({ projects, chatSessions }: ActivityTabProps): ReactNode {
  const hasActivity = projects.length > 0 || chatSessions.length > 0;

  // Categorize projects and sessions
  const rfps = projects.filter((p) => p.projectType === 'rfp');
  const contracts = projects.filter((p) => p.projectType === 'contract-review');
  const otherProjects = projects.filter((p) => !['rfp', 'contract-review'].includes(p.projectType));
  const chats = chatSessions.filter((s) => s.sessionType === 'chat');
  const collateral = chatSessions.filter((s) => s.sessionType === 'collateral');

  if (!hasActivity) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity Yet</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          When you link RFPs, contracts, chat sessions, or collateral to this customer, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ActivitySection title="RFPs" count={rfps.length} icon={FileSpreadsheet} iconColor="text-blue-600">
        {rfps.map((project) => (
          <ActivityItem
            key={project.id}
            href={`/v2/rfps/${project.id}`}
            hoverColor="hover:border-blue-300"
            icon={PROJECT_ICONS[project.projectType] || FileText}
            title={project.name}
            subtitle={`${project.rowCount} question${project.rowCount !== 1 ? 's' : ''}`}
            status={project.status}
            updatedAt={project.updatedAt}
          />
        ))}
      </ActivitySection>

      <ActivitySection title="Contract Reviews" count={contracts.length} icon={ScrollText} iconColor="text-purple-600">
        {contracts.map((project) => (
          <ActivityItem
            key={project.id}
            href={`/v2/contracts/${project.id}`}
            hoverColor="hover:border-purple-300"
            icon={ScrollText}
            title={project.name}
            status={project.status}
            updatedAt={project.updatedAt}
          />
        ))}
      </ActivitySection>

      <ActivitySection title="Chat Sessions" count={chats.length} icon={MessageSquare} iconColor="text-green-600">
        {chats.map((session) => (
          <ActivityItem
            key={session.id}
            href={`/v2/chat?session=${session.id}`}
            hoverColor="hover:border-green-300"
            icon={SESSION_ICONS[session.sessionType] || MessageSquare}
            title={session.title || 'Untitled Chat'}
            subtitle={`${session.messageCount} message${session.messageCount !== 1 ? 's' : ''}`}
            status={session.status}
            updatedAt={session.updatedAt}
          />
        ))}
      </ActivitySection>

      <ActivitySection title="Collateral" count={collateral.length} icon={FileText} iconColor="text-amber-600">
        {collateral.map((session) => (
          <ActivityItem
            key={session.id}
            href={`/v2/collateral?session=${session.id}`}
            hoverColor="hover:border-amber-300"
            icon={SESSION_ICONS[session.sessionType] || FileText}
            title={session.title || 'Untitled Collateral'}
            subtitle={`${session.messageCount} message${session.messageCount !== 1 ? 's' : ''}`}
            status={session.status}
            updatedAt={session.updatedAt}
          />
        ))}
      </ActivitySection>

      <ActivitySection title="Other Projects" count={otherProjects.length} icon={FileText} iconColor="text-gray-600">
        {otherProjects.map((project) => (
          <ActivityItem
            key={project.id}
            href={`/v2/projects/${project.id}`}
            hoverColor="hover:border-gray-300"
            icon={PROJECT_ICONS[project.projectType] || FileText}
            title={project.name}
            subtitle={PROJECT_TYPE_LABELS[project.projectType] || project.projectType}
            status={project.status}
            updatedAt={project.updatedAt}
          />
        ))}
      </ActivitySection>
    </div>
  );
}
