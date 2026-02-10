# Architecture Diagrams

Visual guides to understanding the Transparent Trust platform.

---

## 1. High-Level Overview

The core concept: **Sources + Prompt = Output**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRANSPARENT TRUST PLATFORM                          │
│                                                                             │
│                        The Building Blocks Model                            │
└─────────────────────────────────────────────────────────────────────────────┘


    ┌─────────────────────────────────────────────────────────────────────┐
    │                           SOURCES                                   │
    │                                                                     │
    │   Where your knowledge comes from:                                  │
    │                                                                     │
    │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
    │   │  Slack  │ │ Zendesk │ │  Gong   │ │ Notion  │ │URLs/Docs│     │
    │   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │
    │                                                                     │
    │   Sources are discovered, staged, and assigned to skills            │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                           SKILLS                                    │
    │                                                                     │
    │   Structured knowledge extracted from sources:                      │
    │                                                                     │
    │   ┌─────────────────────────────────────────────────────────────┐  │
    │   │  Global Libraries          │  Customer Libraries            │  │
    │   │  ─────────────────         │  ───────────────────           │  │
    │   │  • IT Knowledge            │  • Acme account details        │  │
    │   │  • GTM Playbooks           │  • Globex integrations         │  │
    │   │  • General KB              │  • Per-customer context        │  │
    │   └─────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │   Each skill has: content, citations, common Q&A, categories        │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                                                                     │
    │                    SOURCES + PROMPT = OUTPUT                        │
    │                                                                     │
    │   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐  │
    │   │               │      │               │      │               │  │
    │   │    SKILLS     │  +   │    PROMPT     │  =   │    OUTPUT     │  │
    │   │   (context)   │      │ (instructions)│      │   (answer)    │  │
    │   │               │      │               │      │               │  │
    │   └───────────────┘      └───────────────┘      └───────────────┘  │
    │                                                                     │
    │   The prompt tells the AI how to use your skills to answer.         │
    │   Different prompts = different output formats and behaviors.       │
    │                                                                     │
    └─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                        AI FEATURES                                  │
    │                                                                     │
    │   Different ways to query your skills:                              │
    │                                                                     │
    │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
    │   │    CHAT     │    │     RFP     │    │  CONTRACTS  │            │
    │   │             │    │             │    │             │            │
    │   │ Interactive │    │   Batch     │    │  Document   │            │
    │   │    Q&A      │    │ processing  │    │  analysis   │            │
    │   └─────────────┘    └─────────────┘    └─────────────┘            │
    │                                                                     │
    │   All outputs:                                                      │
    │   • Based ONLY on your skills (no hallucination)                    │
    │   • Include citations to sources                                    │
    │   • Full transparency on what was used                              │
    │                                                                     │
    └─────────────────────────────────────────────────────────────────────┘


    Supporting:
    ┌─────────────────────────────────────────────────────────────────────┐
    │  CUSTOMERS                      │  ADMIN                            │
    │  ───────────                    │  ─────                            │
    │  • Profiles (company, contacts) │  • Prompt editor                  │
    │  • Health scores                │  • User management                │
    │  • Link to customer skills      │  • Team settings                  │
    └─────────────────────────────────────────────────────────────────────┘
```

**Key Concept**: Everything is a building block. Sources feed skills, skills provide context, prompts provide instructions, and the combination produces accurate, cited outputs.

---

## 2. Data Flow Diagram

How information moves through the system from source to answer.

```
                    ┌──────────────────────────────────────────┐
                    │           EXTERNAL SOURCES               │
                    │                                          │
                    │  Slack   Zendesk   Notion   Gong   URLs  │
                    │    │        │        │       │      │    │
                    └────┼────────┼────────┼───────┼──────┼────┘
                         │        │        │       │      │
                         └────────┴────────┼───────┴──────┘
                                           │
                    ┌──────────────────────▼───────────────────┐
                    │          DISCOVERY & STAGING             │
                    │                                          │
                    │  ┌─────────────────────────────────┐     │
                    │  │     Staged Source Inbox         │     │
                    │  │                                 │     │
                    │  │  • New items await review       │     │
                    │  │  • Preview content              │     │
                    │  │  • Decide: assign or ignore     │     │
                    │  └─────────────────────────────────┘     │
                    └──────────────────────────────────────────┘
                                           │
                              ┌────────────┼────────────┐
                              │            │            │
                              ▼            ▼            ▼
                         ┌────────┐   ┌────────┐   ┌────────┐
                         │ Assign │   │ Create │   │ Ignore │
                         │   to   │   │  New   │   │        │
                         │ Skill  │   │ Skill  │   │        │
                         └────┬───┘   └────┬───┘   └────────┘
                              │            │
                              └──────┬─────┘
                                     │
                    ┌────────────────▼─────────────────────────┐
                    │              SKILL LIBRARY               │
                    │                                          │
                    │  Global Libraries:                        │
                    │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
                    │  │   IT    │ │   GTM   │ │Knowledge│    │
                    │  │ Skills  │ │ Skills  │ │ Skills  │    │
                    │  └─────────┘ └─────────┘ └─────────┘    │
                    │                                          │
                    │  Customer-Specific Libraries:             │
                    │  ┌─────────────────────────────────────┐ │
                    │  │ Acme Skills │ Globex Skills │ ...   │ │
                    │  │ (account    │ (account      │       │ │
                    │  │  details,   │  details,     │       │ │
                    │  │  contracts) │  integrations)│       │ │
                    │  └─────────────────────────────────────┘ │
                    │                                          │
                    │  Each skill:                              │
                    │  • Title & content                        │
                    │  • Source citations                       │
                    │  • Common Q&A                             │
                    │  • Categories/tags                        │
                    └──────────────────────────────────────────┘
                                           │
                                           │ User selects skills
                                           │ for context
                                           ▼
                    ┌──────────────────────────────────────────┐
                    │               AI ENGINE                   │
                    │                                          │
                    │  Question ─────────────────────────────► │
                    │                                          │
                    │  ┌─────────────────────────────────┐     │
                    │  │     Prompt Assembly             │     │
                    │  │                                 │     │
                    │  │  System prompt (from registry)  │     │
                    │  │  + Selected skills as context   │     │
                    │  │  + User preferences             │     │
                    │  │  + Runtime modifiers            │     │
                    │  └─────────────────────────────────┘     │
                    │                     │                     │
                    │                     ▼                     │
                    │  ┌─────────────────────────────────┐     │
                    │  │     Claude AI (LLM)             │     │
                    │  │                                 │     │
                    │  │  Answers ONLY from provided     │     │
                    │  │  skill content                  │     │
                    │  └─────────────────────────────────┘     │
                    │                     │                     │
                    │                     ▼                     │
                    │  Answer + Citations + Transparency ─────►│
                    └──────────────────────────────────────────┘
                                           │
                    ┌──────────────────────▼───────────────────┐
                    │               OUTPUT                      │
                    │                                          │
                    │  • Chat responses with sources           │
                    │  • RFP batch answers                     │
                    │  • Customer-specific answers             │
                    │  • Export to Excel/PDF                   │
                    └──────────────────────────────────────────┘
```

**The Magic**: Sources flow in, get organized into skills, and the AI uses those skills to give accurate, cited answers.

---

## 3. Component Architecture

Detailed technical view for developers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pages (/app/v2/)                    Components (/components/v2/)           │
│  ┌──────────────────────────┐        ┌──────────────────────────┐          │
│  │ /knowledge, /it, /gtm    │        │ UnifiedSkillDetail       │          │
│  │ /customers               │        │ UnifiedLibraryClient     │          │
│  │ /customers/[slug]        │        │ UnifiedSourceWizard      │          │
│  │ /chat                    │        │ CreateSkillModal         │          │
│  │ /rfps                    │        │ KnowledgeBar             │          │
│  │ /admin                   │        │ ChatInterface            │          │
│  └──────────────────────────┘        └──────────────────────────┘          │
│                                                                             │
│  State (Zustand)                     Config-driven rendering                │
│  ┌──────────────────────────┐        ┌──────────────────────────┐          │
│  │ selection-store          │        │ library-ui-config.ts     │          │
│  │ (selected skills)        │        │ (fields per library)     │          │
│  │ settings-store           │        │ source-wizard-config.ts  │          │
│  │ (user prefs)             │        │ (integration configs)    │          │
│  └──────────────────────────┘        └──────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ HTTP/JSON
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER (/api/v2/)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Blocks API                 Customers API           Chat API                │
│  ┌────────────────┐         ┌────────────────┐     ┌────────────────┐      │
│  │ GET  /blocks   │         │ CRUD /customers│     │ POST /chat     │      │
│  │ CRUD /blocks/id│         │ GET  /[id]     │     │ GET  /sessions │      │
│  │ POST /skills   │         │ GET  /[id]/    │     │ POST /sessions │      │
│  │      /create   │         │      skills    │     │                │      │
│  └────────────────┘         └────────────────┘     └────────────────┘      │
│                                                                             │
│  Projects API               Integrations API        Admin API               │
│  ┌────────────────┐         ┌────────────────┐     ┌────────────────┐      │
│  │ POST /upload   │         │ GET  /slack/   │     │ CRUD /prompts  │      │
│  │ GET  /preview  │         │      discover  │     │ GET  /blocks   │      │
│  │ POST /process  │         │ POST /slack/   │     │      (admin)   │      │
│  │ GET  /status   │         │      stage     │     │                │      │
│  └────────────────┘         │ (+ zendesk,    │     └────────────────┘      │
│                             │  gong, notion) │                              │
│                             └────────────────┘                              │
│                                                                             │
│  Auth Pattern: requireAuth() → validateInput() → authorize() → service()   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER (/lib/v2/)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   blocks/   │  │ customers/  │  │   skills/   │  │  sources/   │        │
│  │             │  │             │  │             │  │             │        │
│  │ createBlock │  │ createCust  │  │ orchestrator│  │ stageSource │        │
│  │ queryBlocks │  │ queryCust   │  │ generation  │  │ assignSource│        │
│  │ updateBlock │  │ canAccess   │  │ update      │  │ adapters/   │        │
│  │ deleteBlock │  │ canManage   │  │ matching    │  │  • slack    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  │  • zendesk  │        │
│                                                      │  • gong     │        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  • notion   │        │
│  │   teams/    │  │    rfp/     │  │integrations/│  └─────────────┘        │
│  │             │  │             │  │             │                          │
│  │ canAccess   │  │ uploadParse │  │ handlers/   │                          │
│  │  Library    │  │ skillMatch  │  │ middleware  │                          │
│  │ canManage   │  │ batchProc   │  │ discovery   │                          │
│  │  Library    │  │             │  │             │                          │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LLM LAYER (/lib/llm/)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Entry Point                Prompt System                                   │
│  ┌────────────────────┐     ┌────────────────────────────────────────┐     │
│  │ executeLLMCall()   │     │              REGISTRY                  │     │
│  │                    │     │                                        │     │
│  │ • question         │     │  Compositions:                         │     │
│  │ • compositionId ───┼────►│  • chat_response                       │     │
│  │ • skills           │     │  • rfp_single / rfp_batch              │     │
│  │ • runtimeContext   │     │  • skill_creation / skill_update       │     │
│  │                    │     │  • skill_matching                      │     │
│  │ Returns:           │     │                                        │     │
│  │ • answer           │     │  Each composition = list of block IDs  │     │
│  │ • transparency     │     └────────────────────────────────────────┘     │
│  └────────────────────┘                          │                          │
│                                                  ▼                          │
│  Prompt Blocks (/lib/v2/prompts/)                                          │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                    │    │
│  │  blocks/                    compositions/                          │    │
│  │  ┌──────────────────┐       ┌──────────────────┐                  │    │
│  │  │ core-blocks.ts   │       │ chat-rfp-        │                  │    │
│  │  │ • role_*         │       │ compositions.ts  │                  │    │
│  │  │ • source_fidelity│       │                  │                  │    │
│  │  │ • quality_checks │       │ skill-           │                  │    │
│  │  │                  │       │ compositions.ts  │                  │    │
│  │  │ skill-task-*.ts  │       │                  │                  │    │
│  │  │ skill-output-*.ts│       └──────────────────┘                  │    │
│  │  │ runtime-blocks.ts│                                              │    │
│  │  └──────────────────┘                                              │    │
│  │                                                                    │    │
│  │  builder.ts ──► Assembles blocks into final system prompt          │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Output: systemPrompt + skill content ──► Claude API ──► answer            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER (Prisma)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Core Tables                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  BuildingBlock (Unified model)      Customer (Separate table)       │   │
│  │  ┌─────────────────────────┐        ┌─────────────────────────┐    │   │
│  │  │ id, slug, title         │        │ id, name, industry      │    │   │
│  │  │ libraryId (enum)        │        │ tier, healthScore       │    │   │
│  │  │ customerId (nullable)   │───────►│ contacts (JSON)         │    │   │
│  │  │ content, categories     │        │ teamId, ownerId         │    │   │
│  │  │ attributes (JSON)       │        └─────────────────────────┘    │   │
│  │  │ tier, isActive          │                                        │   │
│  │  └─────────────────────────┘                                        │   │
│  │                                                                     │   │
│  │  Unique: [libraryId, customerId, slug]                              │   │
│  │  → Same slug OK for different customers                             │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Source Tables                         Processing Tables                    │
│  ┌─────────────────────────┐          ┌─────────────────────────┐          │
│  │ StagedSource            │          │ BulkProject             │          │
│  │ • sourceType            │          │ • name, status          │          │
│  │ • externalId            │          │ • uploadedFile          │          │
│  │ • libraryId, customerId │          │                         │          │
│  │ • title, content        │          │ BulkRow                 │          │
│  │ • metadata (JSON)       │          │ • question, outputData  │          │
│  │ • status                │          │ • status                │          │
│  │                         │          │                         │          │
│  │ SourceAssignment        │          │ ChatSession             │          │
│  │ • sourceId → blockId    │          │ ChatMessage             │          │
│  └─────────────────────────┘          └─────────────────────────┘          │
│                                                                             │
│  Auth Tables                           Observability                        │
│  ┌─────────────────────────┐          ┌─────────────────────────┐          │
│  │ User, Team              │          │ LLMTrace                │          │
│  │ TeamMembership          │          │ • prompt, response      │          │
│  │ Account, Session        │          │ • tokens, latency       │          │
│  └─────────────────────────┘          └─────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Customer-Scoped Data Model

How customer data and skills are organized.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TEAM OWNERSHIP                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   TEAM                                      │
│                                                                             │
│   Members ────────────────────────────────────────────────────────────┐     │
│   • User A (admin)                                                    │     │
│   • User B (member)                                                   │     │
│   • User C (member)                                                   │     │
│                                                                       │     │
└───────────────────────────────────────────────────────────────────────┼─────┘
                                       │                                │
            ┌──────────────────────────┼──────────────────────────┐     │
            │                          │                          │     │
            ▼                          ▼                          ▼     │
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│  GLOBAL LIBRARIES │      │  GLOBAL LIBRARIES │      │  GLOBAL LIBRARIES │
│                   │      │                   │      │                   │
│    knowledge      │      │        it         │      │       gtm         │
│                   │      │                   │      │                   │
│ ┌───────────────┐ │      │ ┌───────────────┐ │      │ ┌───────────────┐ │
│ │ Product FAQ   │ │      │ │ VPN Setup     │ │      │ │ Sales Deck    │ │
│ │ Pricing Info  │ │      │ │ SSO Config    │ │      │ │ Competitor    │ │
│ │ API Docs      │ │      │ │ Permissions   │ │      │ │   Analysis    │ │
│ └───────────────┘ │      │ └───────────────┘ │      │ └───────────────┘ │
│                   │      │                   │      │                   │
│ Shared by all     │      │ Shared by all     │      │ Shared by all     │
│ team members      │      │ team members      │      │ team members      │
└───────────────────┘      └───────────────────┘      └───────────────────┘
                                       │
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            │                                                     │
            │              CUSTOMER LIBRARY NAMESPACE             │
            │              (libraryId = 'customers')              │
            │                                                     │
            │  ┌────────────────────────────────────────────────┐ │
            │  │        FOUNDATIONAL SKILL TEMPLATES            │ │
            │  │             (customerId = null)                │ │
            │  │                                                │ │
            │  │  • Account Background & Contract Details       │ │
            │  │  • Strategic Objectives & Success Metrics      │ │
            │  │  • Product Usage & Adoption Patterns           │ │
            │  │  • Value Delivered & Use Case Outcomes         │ │
            │  │  • ... (11 default templates)                  │ │
            │  │                                                │ │
            │  │  These are TEMPLATES - no content yet.         │ │
            │  │  Clone to customers to populate.               │ │
            │  └────────────────────────────────────────────────┘ │
            │                          │                          │
            │           "Apply to Customers" (clone)              │
            │                          │                          │
            │       ┌──────────────────┼──────────────────┐       │
            │       │                  │                  │       │
            │       ▼                  ▼                  ▼       │
            │  ┌─────────┐        ┌─────────┐        ┌─────────┐  │
            │  │  ACME   │        │ GLOBEX  │        │ INITECH │  │
            │  │ Profile │        │ Profile │        │ Profile │  │
            │  └────┬────┘        └────┬────┘        └────┬────┘  │
            │       │                  │                  │       │
            │       ▼                  ▼                  ▼       │
            │  Customer              Customer            Customer │
            │  Table Record          Table Record        Table    │
            │  ┌───────────┐         ┌───────────┐      ┌───────┐ │
            │  │ id: acme  │         │ id: globex│      │id:init│ │
            │  │ name      │         │ name      │      │ name  │ │
            │  │ industry  │         │ industry  │      │indust.│ │
            │  │ tier      │         │ tier      │      │ tier  │ │
            │  │ contacts[]│         │ contacts[]│      │contact│ │
            │  └───────────┘         └───────────┘      └───────┘ │
            │       │                  │                  │       │
            │       ▼                  ▼                  ▼       │
            │  Customer Skills      Customer Skills     Customer  │
            │  (BuildingBlocks)     (BuildingBlocks)    Skills    │
            │  ┌───────────────┐    ┌───────────────┐   ┌───────┐ │
            │  │libraryId:     │    │libraryId:     │   │library│ │
            │  │ 'customers'   │    │ 'customers'   │   │'custo'│ │
            │  │customerId:    │    │customerId:    │   │custom │ │
            │  │ 'acme'        │    │ 'globex'      │   │'init' │ │
            │  │               │    │               │   │       │ │
            │  │• Account Info │    │• Account Info │   │• Acct │ │
            │  │• Integration  │    │• Integration  │   │• Integ│ │
            │  │  Details      │    │  Details      │   │       │ │
            │  │• Custom Procs │    │• Compliance   │   │• Reqs │ │
            │  └───────────────┘    └───────────────┘   └───────┘ │
            │                                                     │
            └─────────────────────────────────────────────────────┘

UNIQUE CONSTRAINT: [libraryId, customerId, slug]
→ Acme can have "integration-guide" AND Globex can have "integration-guide"
→ They don't collide because customerId is different
```

---

## 5. Foundational Skills Flow

How template skills get cloned and populated for customers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FOUNDATIONAL SKILLS FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: Create Template (Admin)
────────────────────────────────

    /v2/customers → "Foundational Skills" tab → "Create"

    ┌─────────────────────────────────────────────────────────────┐
    │           FOUNDATIONAL SKILL TEMPLATE                       │
    │                                                             │
    │  Title: "Account Background & Contract Details"             │
    │                                                             │
    │  Scope Definition:                                          │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │ covers:                                              │   │
    │  │   "Contract terms, renewal dates, pricing tiers,    │   │
    │  │    account history, key milestones"                 │   │
    │  │                                                     │   │
    │  │ futureAdditions:                                    │   │
    │  │   • "Expansion opportunities"                       │   │
    │  │   • "Risk factors"                                  │   │
    │  │                                                     │   │
    │  │ notIncluded:                                        │   │
    │  │   • "Technical implementation details"              │   │
    │  │   • "Support ticket history"                        │   │
    │  └─────────────────────────────────────────────────────┘   │
    │                                                             │
    │  Content: EMPTY (populated from sources later)              │
    │                                                             │
    │  Attributes:                                                │
    │  • isFoundational: true                                     │
    │  • customerId: null  ←── TEMPLATE (no customer)             │
    │  • creationMode: 'foundational'                             │
    │  • refreshMode: 'additive'                                  │
    └─────────────────────────────────────────────────────────────┘


STEP 2: Clone to Customers
──────────────────────────

    Click "Apply to Customers" → Select: Acme, Globex

    ┌────────────────────────┐          ┌────────────────────────┐
    │  TEMPLATE              │          │  CUSTOMER INSTANCES    │
    │  (customerId: null)    │          │                        │
    │                        │          │  ┌──────────────────┐  │
    │  Account Background    │──clone──►│  │ Acme             │  │
    │  & Contract Details    │          │  │ customerId: acme │  │
    │                        │          │  │ clonedFrom: tmpl │  │
    │                        │          │  │ content: EMPTY   │  │
    │                        │          │  └──────────────────┘  │
    │                        │          │                        │
    │                        │          │  ┌──────────────────┐  │
    │                        │──clone──►│  │ Globex           │  │
    │                        │          │  │ customerId: glob │  │
    │                        │          │  │ clonedFrom: tmpl │  │
    │                        │          │  │ content: EMPTY   │  │
    │                        │          │  └──────────────────┘  │
    └────────────────────────┘          └────────────────────────┘


STEP 3: Add Sources & Extract Content
─────────────────────────────────────

    Sources are discovered/staged for Acme:

    ┌─────────────────────────────────────────────────────────────┐
    │                   ACME'S STAGED SOURCES                     │
    │                                                             │
    │  ┌─────────────────┐  ┌─────────────────┐                  │
    │  │ Slack Thread    │  │ Zendesk Ticket  │                  │
    │  │ "Acme contract  │  │ "Contract       │                  │
    │  │  renewal disc." │  │  terms question"│                  │
    │  └────────┬────────┘  └────────┬────────┘                  │
    │           │                    │                            │
    │           └────────┬───────────┘                            │
    │                    │                                        │
    │                    ▼                                        │
    │           Assign to Skill                                   │
    │                    │                                        │
    │                    ▼                                        │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │ Acme: Account Background & Contract Details         │   │
    │  │                                                     │   │
    │  │ Content extracted based on scope:                   │   │
    │  │                                                     │   │
    │  │ ## Contract Terms                                   │   │
    │  │ - 3-year agreement signed Jan 2024                  │   │
    │  │ - Enterprise tier, $50k/year                        │   │
    │  │ - Auto-renewal with 60-day notice                   │   │
    │  │                                                     │   │
    │  │ ## Key Milestones                                   │   │
    │  │ - Initial deployment: Feb 2024                      │   │
    │  │ - First expansion: Jul 2024                         │   │
    │  │                                                     │   │
    │  │ Sources: [Slack: thread-123] [Zendesk: ticket-456]  │   │
    │  └─────────────────────────────────────────────────────┘   │
    │                                                             │
    │  refreshMode: 'additive'                                    │
    │  → New sources ADD to content, never regenerate from scratch│
    └─────────────────────────────────────────────────────────────┘


RESULT: Customer-specific skills built from templates
─────────────────────────────────────────────────────

    ┌──────────────────────────────────────────────────────────┐
    │                    ACME PROFILE                          │
    │                                                          │
    │  Skills (built from foundational templates):             │
    │                                                          │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │ Account Background    │ Strategic Objectives      │  │
    │  │ ✓ Content populated   │ ✓ Content populated       │  │
    │  │ 3 sources             │ 2 sources                 │  │
    │  ├────────────────────────────────────────────────────┤  │
    │  │ Product Usage         │ Value Delivered           │  │
    │  │ ○ Awaiting sources    │ ✓ Content populated       │  │
    │  │ 0 sources             │ 5 sources                 │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                                          │
    └──────────────────────────────────────────────────────────┘
```

---

## 6. RFP Processing Pipeline

How questionnaires and RFPs are processed in batch.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RFP PROCESSING PIPELINE                            │
└─────────────────────────────────────────────────────────────────────────────┘


STEP 1: UPLOAD
──────────────

    User uploads Excel/CSV file

    ┌─────────────────────────────────────────────────────────────┐
    │   security_questionnaire.xlsx                               │
    │                                                             │
    │   Sheet 1: "General"                 Sheet 2: "Technical"   │
    │   ┌──────────────────────────┐       ┌────────────────────┐ │
    │   │ Q1: Company background?  │       │ Q20: Encryption?   │ │
    │   │ Q2: Data centers?        │       │ Q21: SOC2?         │ │
    │   │ ...                      │       │ ...                │ │
    │   └──────────────────────────┘       └────────────────────┘ │
    └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────────────────────┐
    │              STRUCTURED UPLOAD PARSER                       │
    │                                                             │
    │  • Multi-sheet support                                      │
    │  • Handles merged cells                                     │
    │  • Detects question columns                                 │
    │  • Extracts categories                                      │
    │                                                             │
    │  Output: Flat list of questions (no clustering)             │
    └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    BULK PROJECT                             │
    │                                                             │
    │  Status: DRAFT                                              │
    │                                                             │
    │  BulkRows:                                                  │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │ Row 1: "What is your company background?"           │   │
    │  │ Row 2: "Where are your data centers located?"       │   │
    │  │ Row 3: "What encryption do you use?"                │   │
    │  │ Row 4: "Are you SOC2 compliant?"                    │   │
    │  │ ...                                                 │   │
    │  │ Row 50: "Describe your incident response process"   │   │
    │  └─────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────┘


STEP 2: SKILL MATCHING
──────────────────────

    User clicks "Preview Skills"

    ┌─────────────────────────────────────────────────────────────┐
    │                  LLM SKILL MATCHER                          │
    │                                                             │
    │  Sample questions ──► Claude ──► Skill relevance scores     │
    │                                                             │
    │  ┌──────────────────────────────────────────────────────┐  │
    │  │ SKILL RECOMMENDATIONS                                │  │
    │  │                                                      │  │
    │  │ HIGH CONFIDENCE:                                     │  │
    │  │ ☑ Security Practices         (matches 35 questions) │  │
    │  │ ☑ Company Overview           (matches 12 questions) │  │
    │  │ ☑ Data Handling Policy       (matches 28 questions) │  │
    │  │                                                      │  │
    │  │ MEDIUM CONFIDENCE:                                   │  │
    │  │ ☐ Infrastructure Details     (matches 8 questions)  │  │
    │  │ ☐ Compliance Certifications  (matches 15 questions) │  │
    │  │                                                      │  │
    │  │ LOW CONFIDENCE:                                      │  │
    │  │ ☐ Product Roadmap            (matches 2 questions)  │  │
    │  └──────────────────────────────────────────────────────┘  │
    │                                                             │
    │  User selects which skills to use                           │
    └─────────────────────────────────────────────────────────────┘


STEP 3: BATCH PROCESSING
────────────────────────

    User clicks "Process" with selected skills

    ┌─────────────────────────────────────────────────────────────┐
    │                  BATCH PROCESSOR                            │
    │                                                             │
    │  Selected Skills: Security, Company, Data Handling          │
    │                                                             │
    │  ┌────────────────────────────────────────────────────┐    │
    │  │ BATCH 1 (questions 1-10)                           │    │
    │  │                                                    │    │
    │  │ System Prompt (from registry: "rfp_batch")         │    │
    │  │ + Selected skill content as context                │    │
    │  │ + 10 questions                                     │    │
    │  │                                                    │    │
    │  │ ──► Claude ──► 10 answers with citations           │    │
    │  └────────────────────────────────────────────────────┘    │
    │                          │                                  │
    │                          ▼                                  │
    │  ┌────────────────────────────────────────────────────┐    │
    │  │ BATCH 2 (questions 11-20)                          │    │
    │  │ ... same process ...                               │    │
    │  └────────────────────────────────────────────────────┘    │
    │                          │                                  │
    │                          ▼                                  │
    │                        ...                                  │
    │                          │                                  │
    │                          ▼                                  │
    │  ┌────────────────────────────────────────────────────┐    │
    │  │ BATCH 5 (questions 41-50)                          │    │
    │  │ ... same process ...                               │    │
    │  └────────────────────────────────────────────────────┘    │
    │                                                             │
    │  Status updates: DRAFT → IN_PROGRESS → COMPLETED            │
    └─────────────────────────────────────────────────────────────┘


STEP 4: STATUS POLLING
──────────────────────

    Frontend polls every 5 seconds:

    GET /api/v2/projects/{id}/process-batch-status

    ┌─────────────────────────────────────────────────────────────┐
    │  PROGRESS DISPLAY                                           │
    │                                                             │
    │  ████████████████████░░░░░░░░░░  40/50 complete             │
    │                                                             │
    │  ✓ Batch 1: 10/10 complete                                  │
    │  ✓ Batch 2: 10/10 complete                                  │
    │  ✓ Batch 3: 10/10 complete                                  │
    │  ✓ Batch 4: 10/10 complete                                  │
    │  ◐ Batch 5: 0/10 in progress...                             │
    │                                                             │
    │  Errors: 0                                                  │
    └─────────────────────────────────────────────────────────────┘


STEP 5: RESULTS
───────────────

    ┌─────────────────────────────────────────────────────────────┐
    │  COMPLETED PROJECT                                          │
    │                                                             │
    │  ┌──────────────────────────────────────────────────────┐  │
    │  │ Q: What encryption do you use?                       │  │
    │  │                                                      │  │
    │  │ A: We use AES-256 encryption for data at rest and    │  │
    │  │    TLS 1.3 for data in transit. All encryption keys  │  │
    │  │    are managed through AWS KMS with automatic        │  │
    │  │    rotation every 90 days.                           │  │
    │  │                                                      │  │
    │  │ Sources: [Security Practices: §2.1 Encryption]       │  │
    │  └──────────────────────────────────────────────────────┘  │
    │                                                             │
    │  [Export to Excel]  [Export to PDF]  [Copy All]             │
    └─────────────────────────────────────────────────────────────┘


ERROR HANDLING:

    If a question fails:
    ┌─────────────────────────────────────────────────────────────┐
    │  Row 23: "Describe your pen testing process"                │
    │  Status: ERROR                                              │
    │  Error: "LLM timeout"                                       │
    │                                                             │
    │  [Retry This Question]  ← POST /api/v2/projects/.../rerun   │
    └─────────────────────────────────────────────────────────────┘
```

---

## 7. Integration Discovery Flow

How external sources are discovered and staged.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       INTEGRATION DISCOVERY FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘


    ┌─────────────────────────────────────────────────────────────┐
    │                    EXTERNAL SYSTEMS                         │
    │                                                             │
    │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
    │   │  Slack  │  │ Zendesk │  │  Gong   │  │ Notion  │       │
    │   │  API    │  │   API   │  │   API   │  │   API   │       │
    │   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
    │        │            │            │            │             │
    └────────┼────────────┼────────────┼────────────┼─────────────┘
             │            │            │            │
             └────────────┴──────┬─────┴────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                  V2 INTEGRATION LAYER                       │
    │                                                             │
    │  /api/v2/integrations/[source]/                             │
    │                                                             │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │ ADAPTERS (src/lib/v2/sources/adapters/)             │   │
    │  │                                                     │   │
    │  │  slack-adapter.ts    → Fetch threads, messages      │   │
    │  │  zendesk-adapter.ts  → Fetch tickets, articles      │   │
    │  │  gong-adapter.ts     → Fetch call transcripts       │   │
    │  │  notion-adapter.ts   → Fetch pages, databases       │   │
    │  │                                                     │   │
    │  │  Each adapter implements:                           │   │
    │  │  • discover(params) → DiscoveredItem[]              │   │
    │  │  • fetchContent(id) → Full content                  │   │
    │  └─────────────────────────────────────────────────────┘   │
    │                                                             │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │ HANDLERS (src/lib/v2/integrations/handlers/)        │   │
    │  │                                                     │   │
    │  │  Normalize response format                          │   │
    │  │  Handle pagination                                  │   │
    │  │  Apply filters (date, channel, etc.)                │   │
    │  └─────────────────────────────────────────────────────┘   │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                   DISCOVERY RESULTS                         │
    │                                                             │
    │   GET /api/v2/integrations/slack/discover                   │
    │       ?channels=support,sales                               │
    │       &libraryId=customers                                  │
    │       &customerId=acme                                      │
    │                                                             │
    │   Response:                                                 │
    │   ┌─────────────────────────────────────────────────────┐  │
    │   │ {                                                   │  │
    │   │   items: [                                          │  │
    │   │     {                                               │  │
    │   │       externalId: "thread-123",                     │  │
    │   │       title: "Acme contract renewal discussion",    │  │
    │   │       preview: "Hey team, Acme wants to discuss..." │  │
    │   │       sourceType: "slack",                          │  │
    │   │       metadata: { channel: "support", date: "..." } │  │
    │   │     },                                              │  │
    │   │     ...                                             │  │
    │   │   ],                                                │  │
    │   │   pagination: { hasMore: true, cursor: "..." }      │  │
    │   │ }                                                   │  │
    │   └─────────────────────────────────────────────────────┘  │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
                                 │
                                 │  User selects items to stage
                                 ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                      STAGING                                │
    │                                                             │
    │   POST /api/v2/integrations/slack/stage                     │
    │   {                                                         │
    │     items: ["thread-123", "thread-456"],                    │
    │     libraryId: "customers",                                 │
    │     customerId: "acme"                                      │
    │   }                                                         │
    │                                                             │
    │   Creates StagedSource records:                             │
    │   ┌─────────────────────────────────────────────────────┐  │
    │   │ StagedSource {                                      │  │
    │   │   sourceType: "slack",                              │  │
    │   │   externalId: "thread-123",                         │  │
    │   │   libraryId: "customers",                           │  │
    │   │   customerId: "acme",      ← Customer-scoped        │  │
    │   │   title: "Acme contract renewal discussion",        │  │
    │   │   content: "Full thread content...",                │  │
    │   │   status: "NEW",                                    │  │
    │   │   metadata: { channel: "support", ... }             │  │
    │   │ }                                                   │  │
    │   └─────────────────────────────────────────────────────┘  │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    SOURCE INBOX                             │
    │                                                             │
    │   ┌─────────────────────────────────────────────────────┐  │
    │   │ Acme Sources (libraryId=customers, customerId=acme) │  │
    │   │                                                     │  │
    │   │ NEW (3)                                              │  │
    │   │ ┌─────────────────────────────────────────────────┐ │  │
    │   │ │ □ Slack: Contract renewal discussion            │ │  │
    │   │ │ □ Zendesk: Billing question #4521               │ │  │
    │   │ │ □ Gong: QBR Call - Q4 2025                      │ │  │
    │   │ └─────────────────────────────────────────────────┘ │  │
    │   │                                                     │  │
    │   │ Actions:                                            │  │
    │   │ • Assign to existing skill                         │  │
    │   │ • Create new skill from source                     │  │
    │   │ • Ignore (won't show again)                        │  │
    │   └─────────────────────────────────────────────────────┘  │
    │                                                             │
    │   Status flow: NEW → REVIEWED → ASSIGNED or IGNORED         │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
                                 │
                                 │  User assigns to skill
                                 ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                  SOURCE ASSIGNMENT                          │
    │                                                             │
    │   ┌─────────────────────────────────────────────────────┐  │
    │   │ SourceAssignment {                                  │  │
    │   │   sourceId: "staged-source-id",                     │  │
    │   │   blockId: "acme-account-background-skill",         │  │
    │   │   createdAt: "..."                                  │  │
    │   │ }                                                   │  │
    │   └─────────────────────────────────────────────────────┘  │
    │                                                             │
    │   StagedSource.status → "ASSIGNED"                          │
    │                                                             │
    │   Triggers skill update:                                    │
    │   • Extract relevant info from source                       │
    │   • Add to skill content (additive for foundational)        │
    │   • Update citations                                        │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUICK REFERENCE                                     │
└─────────────────────────────────────────────────────────────────────────────┘

KEY ENTITIES:
  BuildingBlock    → Skills, personas, templates (unified model)
  Customer         → Customer profiles (separate table)
  StagedSource     → Inbox for content from integrations
  BulkProject      → RFP/questionnaire processing jobs

LIBRARIES:
  knowledge        → General knowledge base
  it               → IT/technical documentation
  gtm              → Sales/GTM playbooks
  customers        → Customer-scoped skills (+ templates when customerId=null)
  prompts          → System prompt blocks

API PATTERNS:
  GET  /api/v2/blocks           → Query blocks
  POST /api/v2/skills/create    → Create skill (any library)
  POST /api/v2/personas/create  → Create persona
  GET  /api/v2/customers        → List customers
  POST /api/v2/chat             → Send chat message
  POST /api/v2/projects/upload  → Upload RFP file

LLM CALLS:
  Always use: executeLLMCall({ compositionId: "...", ... })
  Compositions: chat_response, rfp_single, rfp_batch, skill_creation, etc.

INTEGRATIONS:
  GET  /api/v2/integrations/[source]/discover  → Find items
  POST /api/v2/integrations/[source]/stage     → Stage to inbox

AUTHORIZATION:
  canAccessLibrary(userId, libraryId)   → Read access to library
  canManageLibrary(userId, libraryId)   → Write access to library
  canAccessCustomer(userId, customerId) → Read access to customer
  canManageCustomer(userId, customerId) → Write access to customer

UNIQUE CONSTRAINTS:
  BuildingBlock: [libraryId, customerId, slug]
  StagedSource:  [sourceType, externalId, libraryId, customerId]
```

---

*Generated for Transparent Trust Platform v2*
