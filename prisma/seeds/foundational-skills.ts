/**
 * Foundational Skills Seed Data
 *
 * Creates 11 foundational skills for customer account intelligence.
 * These are templates that can be applied to any customer.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FOUNDATIONAL_SKILLS = [
  {
    title: 'Account Background & Contract Details',
    slug: 'account-background-contract-details',
    libraryId: 'customers',
    summary: 'Core account information including contract terms, company details, and relationship status',
    scopeDefinition: {
      covers: `Company Identity: Full legal company name, primary industry vertical(s), sub-verticals or segments served, company size (employees, revenue range if mentioned), geographical markets served

Contract & Commercial: Total contract committed spend (exact amount + currency), contract period (dates or duration), exact renewal date with auto-renewal terms if mentioned, contract structure (multi-year vs annual vs consumption-based), any escalation clauses or price adjustment terms mentioned

Financial Metrics: Current ARR or daily revenue discussed, revenue per WAU calculations or benchmarks mentioned, account size tier or segment classification, total IT spend % allocated to this category, data infrastructure spend % of total IT

Technology Stack: Data platforms (Snowflake, Databricks, BigQuery, etc.) with versions, orchestration tools (Airflow, dbt, Prefect, etc.) with versions, BI/analytics tools (Looker, Tableau, Power BI, etc.), databases (PostgreSQL, Oracle, MongoDB, etc.), cloud providers (AWS, GCP, Azure) with regions, data warehousing approach

Opportunity Sizing: Total addressable opportunity calculation, IT spend percentages, data infrastructure budget allocation, expansion potential quantified (additional teams, data sources, use cases)

Account Health: Health score with explicit status (Red/Yellow/Green), specific factors driving that assessment, relationship tenure with account, renewal history and any churn risks mentioned, procurement cycle insights (timing, decision process, buyer groups)`,
      futureAdditions: [
        'Contract amendments, expansions, or renegotiations with specific terms and effective dates',
        'Spend pattern shifts with quantified deltas (month-over-month, quarter-over-quarter changes)',
        'Health score trend analysis showing inflection points and root causes of changes',
        'Tech stack migrations planned or in progress with timelines',
        'New procurement contacts identified or process changes implemented',
        'Billing/invoicing structure updates affecting cost allocation or payment terms',
      ],
      notIncluded: [
        'Detailed financial projections or multi-year forecasts (covered in Business Impact & Financial Value skill)',
        'Individual employee performance reviews, compensation details, or HR data',
        'Competitor contract details, pricing, or commercial terms',
        'Internal sales team compensation, quota attainment, or territory assignments',
        'Detailed legal contract language, clause-by-clause analysis, or negotiation history',
      ],
    },
  },

  {
    title: 'Strategic Objectives & Success Metrics',
    slug: 'strategic-objectives-success-metrics',
    libraryId: 'customers',
    summary: 'Business strategies, data/AI initiatives, and measurable goals with timelines',
    scopeDefinition: {
      covers: `Strategic Initiatives: Top 3-5 business strategies with explicit business drivers (revenue growth, operational efficiency, compliance, customer experience, competitive advantage), business outcome each strategy targets, why it matters now according to leadership, timeline for each (12-24 month focus only)

Data/AI Initiatives: Data and AI initiatives tied to specific business outcomes with clear cause-effect relationship, examples: "ML model accuracy improvements to reduce churn by X%", "data infrastructure consolidation to reduce operational costs by $Y", quantified success metrics for each initiative

Measurable Goals: KPIs for each objective (percentages, dollar amounts, time saved, error reduction, risk reduction), baseline metrics if mentioned, target metrics with specific numbers, success measurement methodology (dashboards, reports, business metrics)

Executive Framing: Executive sponsor name and title, decision authority level (C-suite, VP, Director), urgency signals from leadership (board mandate, quarterly focus, competitive pressure, regulatory deadline), resource commitment or budget allocation mentioned, stakeholders involved and their roles

Timelines & Milestones: Concrete timelines (Q1 2024, next 6 months, by end of fiscal year, specific dates), milestone dependencies if mentioned, critical path constraints, planned review cadence or checkpoint dates`,
      futureAdditions: [
        'New strategic initiatives announced in earnings calls, board meetings, or town halls with specific launch timelines',
        'Quantified progress updates showing actual vs target KPI performance',
        'Strategic priority shifts with explicit rationale from leadership (market changes, competitive threats, new regulations)',
        'Executive sponsor changes (promotions, departures, responsibility transfers)',
        'Revised or updated KPIs with explanation of why metrics changed',
        'Completed initiatives with actual outcomes achieved, lessons learned, and realized ROI',
      ],
      notIncluded: [
        'Competitor strategies, roadmaps, or initiatives unless directly mentioned in customer context',
        'Detailed implementation plans, Gantt charts, or internal resource allocation (covered in Implementation Status skill)',
        'Historical initiatives completed more than 2 years ago unless contextualizing current strategy',
        'Aspirational visions without measurable targets, timelines, or executive commitment',
        'Department-level or team-specific goals that don\'t tie to enterprise strategic objectives',
      ],
    },
  },

  {
    title: 'Requirements, Compliance & Security',
    slug: 'requirements-compliance-security',
    libraryId: 'customers',
    summary: 'Technical requirements, business criteria, regulatory compliance, and security standards',
    scopeDefinition: {
      covers: `Technical Requirements: Required capabilities and features, integration requirements (APIs, protocols, data formats), scalability needs (concurrent users, data volume, query complexity), performance criteria (latency, throughput, uptime SLA), infrastructure preferences (cloud vs on-prem, specific regions)

Business Requirements: Cost constraints or budget guardrails, vendor preferences or strategic partnerships, procurement process and approval requirements, vendor evaluation criteria mentioned by customer

Regulatory Compliance: Regulatory frameworks applicable (SOC2, GDPR, HIPAA, CCPA, PCI-DSS, industry-specific regulations), compliance requirements with specific scope (data classification, user access levels), audit requirements and schedules, compliance gaps currently identified, remediation timelines if mentioned

Security & Data Governance: Security standards and policies required, data classification schemes in use, access control requirements (role-based, attribute-based), encryption requirements (in-transit, at-rest), data retention policies and purge requirements, audit logging and monitoring expectations

Privacy & Data Residency: Data residency or sovereignty requirements (country/region restrictions), data localization requirements, privacy concerns explicitly raised, cross-border data transfer restrictions, data subject access and deletion procedures required`,
      futureAdditions: [
        'New regulatory requirements or compliance certifications needed',
        'Updated or strengthened security policies or standards',
        'Additional integration requirements discovered in discovery',
        'Changes in compliance status or audit results',
        'New privacy concerns or data governance policies',
        'Expanded data residency requirements or regional expansions',
      ],
      notIncluded: [
        'Our own product capabilities or compliance certifications (competitive analysis)',
        'Competitor compliance status or certifications',
        'General internal compliance policies unrelated to customer requirements',
        'Legal opinions or contract negotiation details',
        'Industry-wide compliance trends not specific to this customer',
      ],
    },
  },

  {
    title: 'Product Usage & Adoption Patterns',
    slug: 'product-usage-adoption-patterns',
    libraryId: 'customers',
    summary: 'Usage metrics, consumption trends, feature adoption, and health indicators',
    scopeDefinition: {
      covers: `User Engagement: Weekly active users (WAU) with trend direction (growing, stable, declining), WAU by team or department, month-over-month or quarter-over-quarter growth rate if mentioned, adoption curve (early adopters, majority, laggards, adoption velocity)

Consumption Patterns: Query or request volume patterns, anomalies or spikes in usage, peak usage times or seasons, consumption by use case or feature, cost per unit of consumption if tracked, scaling patterns (linear, exponential, plateauing)

Feature Adoption: Features actively used per team, feature adoption rates (early adoption vs late adoption), underutilized features or capabilities identified, use case distribution (top use cases by volume), new use cases being explored

Playbook Execution: Playbook execution history (frequency, success rate), playbooks by team or role, outcomes achieved per playbook, playbooks not being used and reasons why, new playbooks being requested

Health Indicators: Product health dashboard metrics and alerts, incident response metrics (MTTR, resolution rate), error rates or SLA compliance, customer-reported issues or concerns, satisfaction metrics if mentioned`,
      futureAdditions: [
        'New feature adoption rates and user feedback',
        'Consumption trend changes with underlying business drivers',
        'Health score shifts and investigation of root causes',
        'New playbook executions and outcome measurements',
        'Expansion in usage by existing users or teams to new use cases',
        'Churn signals or usage drop-offs with explanations',
      ],
      notIncluded: [
        'Individual user activity logs or personally identifiable usage data',
        'Raw clickstream analytics or session-level details',
        'Support tickets or troubleshooting records',
        'Competitor product usage or feature comparisons',
      ],
    },
  },

  {
    title: 'Organizational Structure & Key Contacts',
    slug: 'organizational-structure-key-contacts',
    libraryId: 'customers',
    summary: 'Org chart, stakeholder relationships, champions, and decision makers',
    scopeDefinition: {
      covers: `Reporting Structure: Organizational hierarchy from line teams up to executive leadership, reporting relationships for key stakeholders, departments or business units involved in engagement, cross-functional team composition if mentioned

Executive Leadership: Executive sponsor name, title, and decision authority level, C-suite involvement (CEO, CTO, CFO, COO involvement and stance), board-level engagement if mentioned, executive priorities and concerns explicitly stated

Champions & Advocates: Technical champion(s) name and title, their influence level within organization (high/medium/low), business champion(s) and their scope (finance, operations, data, IT), internal advocates for solution and why they support it, credibility and track record mentioned

Economic Buyers: Economic buyer(s) name and title, budget authority and approval process, procurement approval chain, approval timeline and any gating factors, cost concerns or budget constraints raised

Stakeholders & Resistance: Key stakeholders involved with stated concerns or risks, detractors or areas of resistance and specific objections raised, skepticism or concerns from specific teams, support needed to overcome resistance, stakeholder alignment status (aligned, neutral, opposed)

Relationship Metrics: Relationship strength assessment per stakeholder (1-5 scale basis), engagement frequency and last interaction date, engagement sentiment (positive, neutral, concerned), response time and responsiveness, prior history with company or contacts if mentioned

Contact Details: Email, phone, preferred communication method (email, Slack, meeting, phone), reporting relationships and escalation paths, backup or alternate contacts identified`,
      futureAdditions: [
        'New hires in relevant roles with their priorities and stance',
        'Organizational restructures, reporting changes, or center-of-excellence formation',
        'Relationship strength changes based on recent interactions',
        'Stakeholder departures or role changes affecting decision process',
        'New champions or detractors identified through recent interactions',
        'Evolution in executive alignment or priority shifts',
      ],
      notIncluded: [
        'Personal information beyond professional contact details and roles',
        'Compensation, bonus structure, or performance review data',
        'Organizational rumors, unconfirmed changes, or gossip',
        'Personal relationships or off-work activities',
        'Stakeholders unrelated to engagement or solution context',
      ],
    },
  },

  {
    title: 'Value Delivered & Use Case Outcomes',
    slug: 'value-delivered-use-case-outcomes',
    libraryId: 'customers',
    summary: 'Implemented use cases, measured impact, customer testimonials, and realized value',
    scopeDefinition: {
      covers: `Production Use Cases: Use case title and description, deployment date or timeline (phase of maturity), teams or departments using it, adoption across organization (rollout status), associated business process improved

Quantified Business Impact: Dollars saved with time period (annual, per deployment, per incident prevented), hours reclaimed per week/month with calculation basis, risks avoided or prevented (incidents, breaches, revenue loss), productivity improvements by team or individual, cycle time or process time reductions

Before/After Narratives: Specific challenge that use case solved, manual process or pain point it replaced, quantified before state (hours spent, incidents per week, error rate), quantified after state (improvement amount, %), timeframe for realization

Customer Testimonials: Verbatim quotes from customer (with speaker name, title, and date), quotes reflecting urgency or frustration with problem, quotes highlighting strategic importance or business impact, quotes about transformation or vision realization, sentiment and authenticity of feedback

Realized ROI: ROI percentage with calculation period (annual, multi-year), payback period in months, net benefit calculations (1-year, 3-year), value breakdown by theme (productivity, risk, collaboration, decision quality), comparison to initial business case if available

Value Realization: Timeline for value realization (immediate, 1 month, 1 quarter, etc.), factors accelerating or delaying value realization, stakeholder involvement in achieving value, sustainability or durability of benefits achieved`,
      futureAdditions: [
        'New use cases deployed or in progress to production',
        'Updated impact measurements as value matures or scales',
        'New customer testimonials or success stories from recent interactions',
        'Expanded value realization from existing use cases to new teams or processes',
        'Long-term benefits or compound effects observed beyond initial measurement',
        'Secondary or unexpected benefits discovered after deployment',
      ],
      notIncluded: [
        'Projected or estimated future value (covered in Business Impact & Financial Value skill)',
        'Competitor value claims or case studies',
        'Unverified ROI numbers or inflated impact claims',
        'Use cases in pilot, POC, or evaluation phases (not yet in production)',
        'Generic capability descriptions without customer-specific measured outcomes',
      ],
    },
  },

  {
    title: 'Coverage & Expansion Opportunities',
    slug: 'coverage-expansion-opportunities',
    libraryId: 'customers',
    summary: 'Current coverage analysis, whitespace gaps, and expansion potential',
    scopeDefinition: {
      covers: `Current Coverage: Teams or business units currently using solution, lines of business covered, data sources integrated today, use cases actively deployed, geographies or regions covered, percentage of target population reached

Coverage Depth & Breadth: Monitor types or use cases per team, volume of data sources monitored, scope of monitored pipelines or workflows, number of users per team, adoption rate per team or LOB

Whitespace Gaps: Teams or business units not yet using solution, identified gaps with business rationale (not a fit, deprioritized, budget constraint, awareness gap), data sources available but not yet integrated, processes or workflows not yet covered, specific pain points in gap areas

Expansion Opportunities: High-potential teams or LOBs for expansion (with business case), new data source integration opportunities with business impact, target personas or roles not yet engaged, team or LOB-specific expansion with responsible stakeholder, expansion timeline and resource requirements

Expansion Potential: Estimated WAU from expansion (incremental users, % growth), estimated business value from expansion (revenue, efficiency, risk), expansion feasibility assessment (technical, organizational, budgetary), expansion dependencies or blockers identified

Upsell & Cross-Sell: Deeper coverage opportunities in existing areas (more teams, more data sources), new use cases possible with existing infrastructure, adjacent product opportunities, premium or advanced capabilities interest`,
      futureAdditions: [
        'Newly identified whitespace or expansion opportunities',
        'Stakeholder or sponsor changes for expansion areas',
        'Realized expansions and outcomes achieved',
        'New data sources or integration opportunities identified in discovery',
        'Updated expansion potential estimates or business cases',
        'Competitive threats or market changes affecting expansion strategy',
      ],
      notIncluded: [
        'Fully realized expansions or deployments (move to Value Delivered skill)',
        'Rejected or deprioritized opportunities that lack business case or sponsorship',
        'Expansion areas without identified stakeholders or sponsors',
        'Speculative or hypothetical opportunities without customer validation',
      ],
    },
  },

  {
    title: 'Competitive Intelligence & Positioning',
    slug: 'competitive-intelligence-positioning',
    libraryId: 'customers',
    summary: 'Competitive landscape, risks, win/loss insights, and positioning strategy',
    scopeDefinition: {
      covers: `Competitive Landscape: Competitors mentioned or actively evaluated, stage of evaluation per competitor (awareness, consideration, evaluation, negotiation), incumbent solution(s) if any, alternative approaches being considered (build vs buy, internal tools, manual process), market positioning of alternatives

Competitive Risks: Specific competitive threats identified with customer name/title of source, likelihood of competitor win (high/medium/low), potential business impact if competitor wins, momentum or urgency from competitor, competitive advantages they claim vs us, customer concerns about alternatives

Win/Loss Insights: Evaluation criteria favoring or opposing us (explicitly stated), customer perception of us vs alternatives (strengths and weaknesses), prior win/loss outcomes in similar deals, reference customers mentioned by either side, credibility or track record perception

Our Positioning: Our positioning strategy for this customer and key differentiators, differentiators that matter most to this customer vs others, proof points or evidence of differentiation, internal vs external positioning differences if any, messaging that resonates with customer

Mitigation Tactics: Tactics to address competitive threats, customer concerns to overcome, reference customers or testimonials to address specific objections, proof of concept or evaluation approach to win`,
      futureAdditions: [
        'New competitive threats or alternatives mentioned in recent interactions',
        'Updated competitive intelligence or dynamics from customer conversations',
        'Win/loss outcomes or deal closure results',
        'Changes in customer perception or evaluation criteria',
        'New positioning strategies tested or validated in marketplace',
      ],
      notIncluded: [
        'Detailed competitor product feature comparisons unless directly relevant to customer decision',
        'Competitor pricing or commercial terms unless directly mentioned by customer',
        'Unverified competitive claims, rumors, or analyst reports',
        'Competitor customer references or case studies unrelated to this account',
        'Generic competitive intelligence or industry analysis not specific to this customer',
      ],
    },
  },

  {
    title: 'Partner Relationships & Ecosystem',
    slug: 'partner-relationships-ecosystem',
    libraryId: 'customers',
    summary: 'Active partner relationships, joint value propositions, and collaboration status',
    scopeDefinition: {
      covers: `Active Partnerships: Partner name and company, priority level (High/Medium/Low) in this account, reason for partnership or business logic, stage of relationship (inquiry, early engagement, active deployment, mature)

Partnership Value: Desired business outcomes from each partnership (customer perspective), better-together value story and joint positioning, complementary capabilities or integrations, joint use cases or technical integrations in flight or planned

Partner Relationships: Key partner executive relationships with customer (names, titles, relationship strength), customer executive relationships with partner (sponsor level, engagement frequency), partner implementation or support team contacts, prior partnership history with customer if mentioned

Partnership Status: Progress on joint initiatives with timeline, blockers or delays in partnership execution, customer satisfaction with partner, partner performance or delivery quality assessment, expansion of partnership scope if planned

Next Steps: Planned joint initiatives or rollouts (timeline, scope), resource commitments from each side, success criteria for partnership in customer's view`,
      futureAdditions: [
        'New partner relationships identified or opportunities to establish',
        'Partnership evolution and outcomes achieved',
        'New better-together stories or joint value demonstrations',
        'Partner executive relationship changes or departures',
        'Updated partnership priorities or strategic shifts',
        'Partnership churn or relationship ending',
      ],
      notIncluded: [
        'Partner internal operations, strategies, or roadmaps',
        'Partner pricing, commercial terms, or financial details',
        'Unestablished or purely speculative partner relationships',
        'Partners not relevant or active in this specific account',
        'Generic partner ecosystem information not specific to customer',
      ],
    },
  },

  {
    title: 'Current State & Transformation Vision',
    slug: 'current-state-transformation-vision',
    libraryId: 'customers',
    summary: 'Where they are today, challenges faced, and future state vision',
    scopeDefinition: {
      covers: `Current State Challenges: Specific operational friction and pain points experienced, quantified effects (hours lost per week, incidents per month, dollars at risk), teams or processes most affected, root cause of challenges if identified, prior attempts to solve or workarounds in place, customer frustration signals or urgency level

Business Impact: Downstream business impact from challenges (revenue loss, customer impact, compliance risk, operational inefficiency), ripple effects across organization or customers, comparative impact vs competitors handling situation differently, burnout or productivity impact on teams

Future State Vision: Customer's articulated vision for where they want to be (12-24 month timeframe), measurable improvements targeted (hours saved, incidents eliminated, accuracy improved), process changes or transformations envisioned, organizational capabilities or skills needed

Transformation Goals: Specific transformation goals tied to business outcomes (not just technical), timeline for transformation (phases, milestones, end date), dependencies or prerequisites for transformation, resource or budget allocation mentioned

Gap Analysis: Specific gaps between current state and desired future state, technical gaps (capabilities, tools, integrations needed), organizational gaps (skills, processes, governance), timeline or complexity of bridging gaps

Executive Framing: Executive urgency level stated explicitly (board mandate, competitive threat, regulatory deadline, customer satisfaction), strategic importance to organization or business unit, business risks if transformation fails or is delayed, executive commitment or investment level indicated`,
      futureAdditions: [
        'Progress made on transformation initiatives with outcomes achieved',
        'New challenges or pain points discovered during transformation',
        'Updated future state vision as priorities or market dynamics shift',
        'Transformation milestone achievements and learnings',
        'Changed executive framing, urgency level, or commitment level',
        'Obstacles or barriers encountered during transformation',
      ],
      notIncluded: [
        'Generic industry transformation trends unless customer specifically references them',
        'Our solution capabilities or positioning separate from their vision',
        'Competitor transformation approaches or strategies',
        'Historical states or challenges beyond what contextualizes current situation',
      ],
    },
  },

  {
    title: 'Business Impact & Financial Value',
    slug: 'business-impact-financial-value',
    libraryId: 'customers',
    summary: 'ROI analysis, financial projections, forecasting, and quantified business value',
    scopeDefinition: {
      covers: `Realized ROI: ROI percentage with calculation basis (cost of solution vs value realized), payback period in months, net benefit calculations (1-year, 3-year), value realization timeline (months to achieve stated ROI), factors that accelerated or delayed ROI achievement

Value Breakdown: Value breakdown by theme (productivity improvements, risk mitigation, data quality, collaboration/trust), quantification per theme (dollars, hours, risk units), most significant value drivers identified, secondary benefits or unexpected value realized

Financial Projections: ARR projections by quarter or year with basis for projections, consumption growth projections (% or absolute), WAU growth trajectory and expansion assumptions, confidence level in projections (high/medium/low)

Expansion Forecast: Expansion revenue opportunities quantified (new teams, new use cases, new geographies), timeline for each expansion opportunity, resource or investment required per opportunity, probability or confidence in expansion realization

Renewal Likelihood: Renewal likelihood assessment (high/medium/low) with renewal risk factors, potential churn risks or concerns raised, contract renewal timing and key renewal drivers, expansion vs replacement risk if renewal challenged

Cost of Ownership: Total cost of ownership including all direct and indirect costs, licensing/subscription costs, implementation and training costs, ongoing support or professional services costs, cost trends over time (escalations, reductions)

Assumptions & Drivers: Key assumptions underlying all financial models (utilization, WAU growth, cost inflation, etc.), sensitivity analysis if done (what changes ROI?), factors affecting forecast (positive drivers and risks), plan for tracking actual vs forecast accuracy`,
      futureAdditions: [
        'Actual results vs forecast comparison for model accuracy assessment',
        'Updated financial projections based on new information or changed circumstances',
        'New expansion opportunities identified with revenue impact',
        'Changed risk factors affecting renewal probability or growth projections',
        'Revised assumptions with explanation of changes from prior forecast',
        'Additional value realization proof points from new use cases or teams',
      ],
      notIncluded: [
        'Individual deal structures, discounts, or custom pricing details',
        'Internal sales compensation, commission, or incentive structures',
        'Internal sales quotas, territory assignments, or forecasts',
        'Competitor ROI claims or financial comparison analysis',
        'Unverified or speculative financial projections without customer basis',
      ],
    },
  },

  {
    title: 'Implementation Status & Action Items',
    slug: 'implementation-status-action-items',
    libraryId: 'customers',
    summary: 'Project milestones, action items, blockers, and execution timeline',
    scopeDefinition: {
      covers: `Key Milestones: Planned milestones with names (POV wrap-up, production use case mapping, commercials/legal, onboarding, deployment, measure & iterate), target date and actual completion date if passed, current status per milestone (scheduled, in progress, completed, at-risk), dependencies between milestones

Action Items: Owner name and title for each action, action description and business rationale, target completion date and actual date if completed, status (scheduled, in progress, completed, blocked, deferred), priority or criticality to timeline

Blockers & Risks: Specific blockers preventing progress with root cause, customer-side blockers vs partner-side, escalation required (who, by when), workarounds or alternative paths if any, estimated impact on timeline if unresolved

Customer Asks & Commitments: Customer commitments or asks requiring support (resources, access, decisions), timeline pressure or time-sensitive requests, resource allocation customer is providing or withholding

Scheduled Activities: Upcoming meetings or reviews scheduled (kickoff, status, review gates, Go-live), meeting attendees and sponsor level, meeting objectives or success criteria, recurring review cadence if established

Completed Deliverables: Deliverables completed to date with dates and responsible parties, outcomes achieved per deliverable, quality or acceptance feedback received, learnings or course corrections from each phase

Next Steps: Immediate next steps planned with owner and timeline, critical path activities that determine overall timeline, dependencies on customer decisions or actions, recommended cadence for next engagement`,
      futureAdditions: [
        'New milestones or deliverables added or removed from plan',
        'Action item status updates with completion dates and outcomes',
        'Resolved blockers or newly identified blockers with impact assessments',
        'Timeline adjustments with rationale and stakeholder communication',
        'Completed phase retrospectives with learnings and improvement recommendations',
        'Scope changes or reprioritization of remaining milestones',
      ],
      notIncluded: [
        'Detailed internal project management tasks not communicated to customer',
        'Individual contributor schedules, capacity planning, or resource conflicts',
        'Internal team resource allocation or staffing decisions',
        'Milestones, meetings, or activities not customer-facing or transparent',
      ],
    },
  },
];

export async function seedFoundationalSkills(teamId: string, userId: string) {
  console.log('Seeding foundational skills...');

  const created = [];
  for (const skillData of FOUNDATIONAL_SKILLS) {
    const attributes = {
      creationMode: 'foundational',
      refreshMode: 'additive',
      isFoundational: true,
      scopeDefinition: skillData.scopeDefinition,
      auditLog: {
        entries: [
          {
            action: 'created',
            timestamp: new Date().toISOString(),
            userId,
            summary: `Seeded foundational skill: ${skillData.title}`,
          },
        ],
      },
    };

    const skill = await prisma.buildingBlock.create({
      data: {
        title: skillData.title,
        slug: skillData.slug,
        content: '', // Empty - will be populated when sources are attached
        summary: skillData.summary,
        libraryId: skillData.libraryId,
        blockType: 'knowledge',
        skillType: 'intelligence',
        status: 'ACTIVE',
        teamId,
        ownerId: userId,
        attributes: JSON.parse(JSON.stringify(attributes)),
      },
    });

    created.push(skill);
    console.log(`  ✓ Created: ${skill.title}`);
  }

  console.log(`\nSeeded ${created.length} foundational skills`);
  return created;
}

export default seedFoundationalSkills;
