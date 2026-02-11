/**
 * Customer Analysis View Compositions
 *
 * Prompt compositions for generating customer analysis views.
 * These assemble prompts for generating formatted analyses like:
 * - Revenue forecasts
 * - Competitive positioning
 * - Customer risk assessments
 * - Feature recommendations
 */

import type { PromptComposition } from '../types';

export const customerViewCompositions: PromptComposition[] = [
  // ==========================================================================
  // COVERAGE AUDIT - Analyze data quality monitoring coverage from Looker
  // ==========================================================================
  {
    context: 'customer_coverage_audit',
    name: 'Coverage Audit',
    description:
      'Analyze data quality coverage across tables, columns, and monitoring rules from Looker dashboard data.',
    category: 'customer_views',
    usedBy: [
      { feature: 'Customer Coverage Audit View', location: '/v2/customers/[slug]/views/coverage-audit', type: 'ui' },
    ],
    blockIds: [
      'role_coverage_auditor', // Coverage audit perspective
      'customer_context', // Customer-specific context
      'coverage_framework', // Coverage audit framework
      'output_format_coverage_audit', // Coverage audit report format with slide outline
    ],
    outputFormat: 'markdown',
    outputSchema: undefined,
  },

  // ==========================================================================
  // OPERATIONS AUDIT - Analyze alerting system health from Looker dashboard
  // ==========================================================================
  {
    context: 'customer_operations_audit',
    name: 'Operations Audit',
    description:
      'Analyze alerting system health, alert distribution, and operational patterns from Looker dashboard data using the Operations Excellence audit framework.',
    category: 'customer_views',
    usedBy: [
      { feature: 'Customer Operations Audit View', location: '/v2/customers/[slug]/views/operations-audit', type: 'ui' },
    ],
    blockIds: [
      'role_operations_auditor', // Operations audit perspective
      'customer_context', // Customer-specific context
      'audit_framework', // Operations audit framework
      'output_format_audit_unified', // Unified audit format with slide outline
    ],
    outputFormat: 'markdown',
    outputSchema: undefined,
  },

  // ==========================================================================
  // ADOPTION AUDIT - Analyze user adoption and engagement from Looker
  // ==========================================================================
  {
    context: 'customer_adoption_audit',
    name: 'Adoption Audit',
    description:
      'Analyze user adoption patterns, engagement metrics, and feature utilization from Looker dashboard data.',
    category: 'customer_views',
    usedBy: [
      { feature: 'Customer Adoption Audit View', location: '/v2/customers/[slug]/views/adoption-audit', type: 'ui' },
    ],
    blockIds: [
      'role_adoption_auditor', // Adoption audit perspective
      'customer_context', // Customer-specific context
      'adoption_framework', // Adoption audit framework
      'output_format_adoption_audit', // Adoption audit report format with slide outline
    ],
    outputFormat: 'markdown',
    outputSchema: undefined,
  },

  // ==========================================================================
  // ACCOUNT PLAN - Comprehensive QBR-ready account overview
  // ==========================================================================
  {
    context: 'customer_account_plan',
    name: 'Account Plan Analysis',
    description:
      'Generate a comprehensive account plan summarizing account health, strategic priorities, risks, and opportunities for executive review and QBR preparation.',
    category: 'customer_views',
    usedBy: [
      { feature: 'Customer Account Plan View', location: '/v2/customers/[slug]/views/account-plan', type: 'ui' },
    ],
    blockIds: [
      'role_account_planner', // Account planning perspective
      'customer_context', // Customer-specific context
      'competitive_framework', // Competitive landscape context
      'risk_framework', // Risk assessment framework
      'expansion_framework', // Opportunity framework
      'output_format_account_plan', // Account plan format
    ],
    outputFormat: 'markdown',
    outputSchema: undefined,
  },

  // ==========================================================================
  // REVENUE FORECAST - Analyze customer to project revenue trajectory
  // ==========================================================================
  {
    context: 'customer_revenue_forecast',
    name: 'Revenue Forecast Analysis',
    description:
      'Generate a 12-month revenue forecast based on customer profile, tier, health score, and capabilities.',
    category: 'customer_views',
    usedBy: [
      { feature: 'Customer Revenue View', location: '/v2/customers/[slug]/views/revenue', type: 'ui' },
    ],
    blockIds: [
      'role_analyst', // Financial analyst perspective
      'customer_context', // Customer-specific context
      'revenue_modeling', // Revenue projection frameworks
      'output_format_forecast', // Structured forecast format
    ],
    outputFormat: 'markdown',
    outputSchema: undefined,
  },

  // ==========================================================================
  // COMPETITIVE POSITIONING - Analyze competitive advantages and risks
  // ==========================================================================
  {
    context: 'customer_competitive_analysis',
    name: 'Competitive Positioning',
    description:
      'Analyze competitive positioning and risks for this customer based on their profile and product mix.',
    category: 'customer_views',
    usedBy: [
      { feature: 'Customer Competitive View', location: '/v2/customers/[slug]/views/competitive', type: 'ui' },
    ],
    blockIds: [
      'role_strategist', // Strategic planning perspective
      'customer_context', // Customer-specific context
      'competitive_framework', // Competitive analysis frameworks
      'output_format_analysis', // Structured analysis format
    ],
    outputFormat: 'markdown',
    outputSchema: undefined,
  },

  // ==========================================================================
  // CUSTOMER RISK ASSESSMENT - Identify churn and expansion risks
  // ==========================================================================
  {
    context: 'customer_risk_assessment',
    name: 'Risk Assessment',
    description: 'Identify and prioritize risks (churn, expansion, compliance) for account management.',
    category: 'customer_views',
    usedBy: [
      { feature: 'Customer Risk View', location: '/v2/customers/[slug]/views/risk', type: 'ui' },
    ],
    blockIds: [
      'role_risk_analyst', // Risk assessment perspective
      'customer_context', // Customer-specific context
      'risk_framework', // Risk identification and prioritization
      'output_format_risk', // Risk report format
    ],
    outputFormat: 'markdown',
    outputSchema: undefined,
  },

  // ==========================================================================
  // EXPANSION OPPORTUNITIES - Identify upsell and cross-sell opportunities
  // ==========================================================================
  {
    context: 'customer_expansion_opportunities',
    name: 'Expansion Opportunities',
    description: 'Identify upsell, cross-sell, and service expansion opportunities for this customer.',
    category: 'customer_views',
    usedBy: [
      { feature: 'Customer Expansion View', location: '/v2/customers/[slug]/views/expansion', type: 'ui' },
    ],
    blockIds: [
      'role_sales_strategist', // Sales strategy perspective
      'customer_context', // Customer-specific context
      'expansion_framework', // Opportunity identification frameworks
      'output_format_opportunities', // Opportunity format
    ],
    outputFormat: 'markdown',
    outputSchema: undefined,
  },
];

export default customerViewCompositions;
