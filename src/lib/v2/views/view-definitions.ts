/**
 * Code-based View Definitions
 *
 * Views are generators/recipes that produce analysis from customer data.
 * They're not content containers like BuildingBlocks - they're more like
 * prompt compositions with metadata.
 *
 * Each view maps to a composition in customer-view-compositions.ts
 */

export type ViewCategory = 'audit' | 'analysis' | 'planning';

export interface ViewDefinition {
  id: string;
  title: string;
  slug: string;
  summary: string;
  compositionId: string;
  icon: string;
  displayOrder: number;
  /** Category for grouping views (e.g., 'audit' views shown under Audits tab) */
  category?: ViewCategory;
}

/**
 * All available customer analysis views
 * Add new views here - no database seeding required
 */
export const VIEW_DEFINITIONS: ViewDefinition[] = [
  // ==========================================================================
  // AUDIT VIEWS - Grouped under "Audits" tab with sub-navigation
  // ==========================================================================
  {
    id: 'view_coverage_audit',
    title: 'Coverage Audit',
    slug: 'coverage-audit',
    summary:
      'Analyze data quality coverage across tables, columns, and monitoring rules from Looker dashboard data',
    compositionId: 'customer_coverage_audit',
    icon: 'BarChart3',
    displayOrder: 0,
    category: 'audit',
  },
  {
    id: 'view_operations_audit',
    title: 'Operations Audit',
    slug: 'operations-audit',
    summary:
      'Analyze alerting system health, alert distribution, and operational patterns from Looker dashboard data',
    compositionId: 'customer_operations_audit',
    icon: 'CheckCircle',
    displayOrder: 1,
    category: 'audit',
  },
  {
    id: 'view_adoption_audit',
    title: 'Adoption Audit',
    slug: 'adoption-audit',
    summary:
      'Analyze user adoption patterns, engagement metrics, and feature utilization from Looker dashboard data',
    compositionId: 'customer_adoption_audit',
    icon: 'Users',
    displayOrder: 2,
    category: 'audit',
  },

  // ==========================================================================
  // PLANNING VIEWS - Strategic account planning
  // ==========================================================================
  {
    id: 'view_account_plan',
    title: 'Account Plan',
    slug: 'account-plan',
    summary:
      'Comprehensive account overview covering health, strategic priorities, risks, and opportunities for QBR preparation',
    compositionId: 'customer_account_plan',
    icon: 'Briefcase',
    displayOrder: 10,
    category: 'planning',
  },

  // ==========================================================================
  // ANALYSIS VIEWS - Standalone analysis tools
  // ==========================================================================
  {
    id: 'view_revenue_forecast',
    title: 'Revenue Forecast',
    slug: 'revenue-forecast',
    summary:
      'Generate a 12-month revenue forecast based on customer profile, contract details, and usage patterns',
    compositionId: 'customer_revenue_forecast',
    icon: 'TrendingUp',
    displayOrder: 20,
    category: 'analysis',
  },
  {
    id: 'view_competitive_analysis',
    title: 'Competitive Analysis',
    slug: 'competitive-analysis',
    summary: 'Analyze competitive positioning and risks for this customer',
    compositionId: 'customer_competitive_analysis',
    icon: 'Target',
    displayOrder: 21,
    category: 'analysis',
  },
  {
    id: 'view_risk_assessment',
    title: 'Risk Assessment',
    slug: 'risk-assessment',
    summary: 'Identify and prioritize churn, expansion, and compliance risks',
    compositionId: 'customer_risk_assessment',
    icon: 'AlertTriangle',
    displayOrder: 22,
    category: 'analysis',
  },
  {
    id: 'view_expansion_opportunities',
    title: 'Expansion Opportunities',
    slug: 'expansion-opportunities',
    summary: 'Identify upsell, cross-sell, and service expansion opportunities',
    compositionId: 'customer_expansion_opportunities',
    icon: 'Rocket',
    displayOrder: 23,
    category: 'analysis',
  },
];

/**
 * Get all active view definitions
 */
export function getViewDefinitions(): ViewDefinition[] {
  return VIEW_DEFINITIONS.sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Get a view definition by ID
 */
export function getViewDefinitionById(id: string): ViewDefinition | undefined {
  return VIEW_DEFINITIONS.find((v) => v.id === id);
}

/**
 * Get a view definition by slug
 */
export function getViewDefinitionBySlug(slug: string): ViewDefinition | undefined {
  return VIEW_DEFINITIONS.find((v) => v.slug === slug);
}

/**
 * Get view definitions by category
 */
export function getViewDefinitionsByCategory(category: ViewCategory): ViewDefinition[] {
  return VIEW_DEFINITIONS.filter((v) => v.category === category).sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
}

/**
 * Get audit view definitions (convenience function)
 */
export function getAuditViewDefinitions(): ViewDefinition[] {
  return getViewDefinitionsByCategory('audit');
}

/**
 * Get non-audit view definitions (for showing outside the Audits tab)
 */
export function getNonAuditViewDefinitions(): ViewDefinition[] {
  return VIEW_DEFINITIONS.filter((v) => v.category !== 'audit').sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
}
