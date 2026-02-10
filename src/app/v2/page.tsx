'use client';

/**
 * V2 Dashboard
 *
 * Homepage for Platform V2 matching V1's look and feel
 */

import Link from 'next/link';
import { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Building2,
  MessageSquare,
  Users,
  FileText,
  FolderOpen,
  FileSignature,
} from 'lucide-react';

type CardProps = {
  href: string;
  title: string;
  description: string;
  accentColor: string;
  bgColor: string;
  icon: React.ElementType;
  featured?: boolean;
};

function Card({ href, title, description, accentColor, bgColor, featured }: CardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          borderLeft: `4px solid ${accentColor}`,
          borderTop: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '8px',
          padding: featured ? '24px' : '20px',
          backgroundColor: isHovered ? bgColor : 'var(--card)',
          cursor: 'pointer',
          height: '100%',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div
          style={{
            fontSize: featured ? '1.15rem' : '1rem',
            fontWeight: 600,
            marginBottom: '6px',
            color: 'var(--text-heading)',
          }}
        >
          {title}
        </div>
        <p
          style={{
            margin: 0,
            color: 'var(--muted-foreground)',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      </div>
    </Link>
  );
}

export default function V2DashboardPage() {
  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      }}
    >
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            marginBottom: '12px',
            color: 'var(--text-heading)',
          }}
        >
          Platform V2
        </h1>
        <p
          style={{
            fontSize: '1.05rem',
            color: 'var(--muted-foreground)',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Unified knowledge architecture with better performance and scalability.
        </p>
      </div>

      {/* Libraries Section */}
      <div style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px',
          }}
        >
          Knowledge Libraries
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
          The foundation that grounds all AI responses. Your single source of truth.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <Card
            href="/v2/knowledge"
            title="Knowledge Dashboard"
            description="Core knowledge library. Skills, documents, and URLs that ground all AI responses."
            accentColor="var(--accent-blue)"
            bgColor="var(--accent-blue-light)"
            icon={BookOpen}
          />
          <Card
            href="/v2/it"
            title="IT Dashboard"
            description="IT helpdesk knowledge. Troubleshooting guides and technical resolutions."
            accentColor="var(--accent-amber)"
            bgColor="var(--accent-amber-light)"
            icon={HelpCircle}
          />
          <Card
            href="/v2/gtm"
            title="GTM Dashboard"
            description="Manage customer profiles and GTM skills to personalize AI responses for specific accounts and industries."
            accentColor="var(--accent-green)"
            bgColor="#f0fdf4"
            icon={Building2}
          />
          <Card
            href="/v2/talent"
            title="Talent Dashboard"
            description="Recruiting and hiring knowledge. Interview guides, job descriptions, and talent processes."
            accentColor="var(--accent-purple)"
            bgColor="var(--accent-purple-light)"
            icon={Users}
          />
        </div>
      </div>

      {/* Configuration Section */}
      <div style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px',
          }}
        >
          Configuration
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
          Configure how AI responds and structures its output. Control prompts, personas, and templates.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <Card
            href="/v2/prompt-registry"
            title="Prompts"
            description="Configure how AI responds across all features. Edit system prompts and quality rules."
            accentColor="var(--accent-amber)"
            bgColor="var(--accent-amber-light)"
            icon={MessageSquare}
          />
          <Card
            href="/v2/content/personas"
            title="Personas"
            description="Custom AI response styles. Define different modes and behaviors for various use cases."
            accentColor="var(--accent-pink)"
            bgColor="var(--accent-pink-light)"
            icon={Users}
          />
          <Card
            href="/v2/content/templates"
            title="Templates"
            description="Collateral templates for generating slide decks, one-pagers, and other structured content."
            accentColor="var(--accent-teal)"
            bgColor="var(--accent-teal-light)"
            icon={FileText}
          />
        </div>
      </div>

      {/* Tools Section */}
      <div style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px',
          }}
        >
          Tools
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <Card
            href="/v2/chat"
            title="Chat"
            description="Chat with your knowledge base. Choose a library, adjust settings, and see exactly what context goes to AI."
            accentColor="var(--accent-cyan)"
            bgColor="var(--accent-cyan-light)"
            icon={MessageSquare}
          />
          <Card
            href="/v2/rfps"
            title="RFPs"
            description="Answer single questions or batch process RFPs. Upload spreadsheets and process hundreds of questions in bulk."
            accentColor="#22c55e"
            bgColor="#f0fdf4"
            icon={FolderOpen}
          />
          <Card
            href="/v2/collateral"
            title="Collateral Builder"
            description="Generate slide decks, one-pagers, and battlecards. AI fills templates with customer-specific content."
            accentColor="var(--accent-indigo)"
            bgColor="var(--accent-indigo-light)"
            icon={FileText}
          />
          <Card
            href="/v2/contracts"
            title="Contracts"
            description="Upload and analyze contracts. Extract key terms, identify risks, and review obligations."
            accentColor="var(--accent-orange)"
            bgColor="var(--accent-orange-light)"
            icon={FileSignature}
          />
        </div>
      </div>

      {/* Full Transparency Section */}
      <div
        style={{
          borderRadius: '12px',
          padding: '28px',
          backgroundColor: 'var(--surface-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <h2
          style={{
            margin: '0 0 24px 0',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-heading)',
          }}
        >
          Full Transparency, Every Time
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--info)', fontSize: '0.95rem', fontWeight: 600 }}>
              Confidence Scores
            </h4>
            <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Every answer includes a confidence level so you know when to trust it and when to verify.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--info)', fontSize: '0.95rem', fontWeight: 600 }}>
              Source Citations
            </h4>
            <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              See exactly which skills, documents, and URLs were used to generate each response.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--info)', fontSize: '0.95rem', fontWeight: 600 }}>
              Reasoning Visible
            </h4>
            <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Understand the logic: what was found directly vs. what was inferred from context.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--info)', fontSize: '0.95rem', fontWeight: 600 }}>
              Editable Prompts
            </h4>
            <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              No black boxes. View and customize the system prompts that guide AI behavior.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
