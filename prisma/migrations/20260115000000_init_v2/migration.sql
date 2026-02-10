-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "libraries" TEXT[],
    "monthlyTokenLimit" INTEGER,
    "currentMonthTokens" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingBlock" (
    "id" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "entryType" TEXT,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "categories" TEXT[],
    "tier" TEXT NOT NULL DEFAULT 'library',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "teamId" TEXT,
    "ownerId" TEXT,
    "parentCustomerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "gitPath" TEXT,
    "gitCommitSha" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildingBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagedSource" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "contentPreview" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "stagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stagedBy" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "ignoredBy" TEXT,

    CONSTRAINT "StagedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceAssignment" (
    "id" TEXT NOT NULL,
    "stagedSourceId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "incorporatedAt" TIMESTAMP(3),
    "incorporatedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "SourceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "integrationType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectType" TEXT NOT NULL,
    "teamId" TEXT,
    "ownerId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "finalizedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkRow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "inputData" JSONB NOT NULL DEFAULT '{}',
    "outputData" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "tokensUsed" INTEGER,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flaggedAt" TIMESTAMP(3),
    "flaggedBy" TEXT,
    "flagNote" TEXT,
    "flagResolved" BOOLEAN NOT NULL DEFAULT false,
    "flagResolvedAt" TIMESTAMP(3),
    "flagResolvedBy" TEXT,
    "flagResolutionNote" TEXT,
    "reviewStatus" TEXT,
    "reviewRequestedAt" TIMESTAMP(3),
    "reviewRequestedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "userEditedAnswer" TEXT,
    "clarifyConversation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "V2QuestionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "question" TEXT NOT NULL,
    "context" TEXT,
    "library" TEXT NOT NULL DEFAULT 'skills',
    "modelSpeed" TEXT NOT NULL DEFAULT 'quality',
    "outputData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "tokensUsed" INTEGER,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flaggedAt" TIMESTAMP(3),
    "flaggedBy" TEXT,
    "flagNote" TEXT,
    "flagResolved" BOOLEAN NOT NULL DEFAULT false,
    "flagResolvedAt" TIMESTAMP(3),
    "flagResolvedBy" TEXT,
    "flagResolutionNote" TEXT,
    "reviewStatus" TEXT,
    "reviewRequestedAt" TIMESTAMP(3),
    "reviewRequestedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "userEditedAnswer" TEXT,
    "clarifyConversation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V2QuestionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "sessionType" TEXT NOT NULL DEFAULT 'general',
    "teamId" TEXT,
    "userId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatBlockUsage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "usageType" TEXT NOT NULL,
    "wasHelpful" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatBlockUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMTrace" (
    "id" TEXT NOT NULL,
    "traceId" TEXT,
    "sessionId" TEXT,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "context" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "result" JSONB,
    "errorMessage" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "teamId" TEXT,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[],
    "rateLimit" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "targetType" TEXT,
    "targetId" TEXT,
    "teamId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackBotInteraction" (
    "id" TEXT NOT NULL,
    "slackTeamId" TEXT NOT NULL,
    "slackChannelId" TEXT NOT NULL,
    "slackChannelName" TEXT,
    "slackThreadTs" TEXT NOT NULL,
    "slackMessageTs" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "slackUserName" TEXT,
    "slackPermalink" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidence" TEXT,
    "skillsUsed" JSONB NOT NULL DEFAULT '[]',
    "skillsSearched" INTEGER NOT NULL DEFAULT 0,
    "responseTimeMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "wasHelpful" BOOLEAN,
    "userFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackBotInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "Team_slug_idx" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "TeamMembership_userId_idx" ON "TeamMembership"("userId");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_userId_teamId_key" ON "TeamMembership"("userId", "teamId");

-- CreateIndex
CREATE INDEX "BuildingBlock_blockType_libraryId_status_idx" ON "BuildingBlock"("blockType", "libraryId", "status");

-- CreateIndex
CREATE INDEX "BuildingBlock_teamId_idx" ON "BuildingBlock"("teamId");

-- CreateIndex
CREATE INDEX "BuildingBlock_ownerId_idx" ON "BuildingBlock"("ownerId");

-- CreateIndex
CREATE INDEX "BuildingBlock_categories_idx" ON "BuildingBlock"("categories");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingBlock_libraryId_slug_key" ON "BuildingBlock"("libraryId", "slug");

-- CreateIndex
CREATE INDEX "StagedSource_libraryId_stagedAt_idx" ON "StagedSource"("libraryId", "stagedAt");

-- CreateIndex
CREATE INDEX "StagedSource_sourceType_libraryId_idx" ON "StagedSource"("sourceType", "libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "StagedSource_sourceType_externalId_libraryId_key" ON "StagedSource"("sourceType", "externalId", "libraryId");

-- CreateIndex
CREATE INDEX "SourceAssignment_stagedSourceId_idx" ON "SourceAssignment"("stagedSourceId");

-- CreateIndex
CREATE INDEX "SourceAssignment_blockId_idx" ON "SourceAssignment"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceAssignment_stagedSourceId_blockId_key" ON "SourceAssignment"("stagedSourceId", "blockId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_teamId_integrationType_idx" ON "IntegrationConnection"("teamId", "integrationType");

-- CreateIndex
CREATE INDEX "BulkProject_teamId_idx" ON "BulkProject"("teamId");

-- CreateIndex
CREATE INDEX "BulkProject_ownerId_idx" ON "BulkProject"("ownerId");

-- CreateIndex
CREATE INDEX "BulkProject_status_idx" ON "BulkProject"("status");

-- CreateIndex
CREATE INDEX "BulkRow_projectId_status_idx" ON "BulkRow"("projectId", "status");

-- CreateIndex
CREATE INDEX "BulkRow_reviewStatus_idx" ON "BulkRow"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BulkRow_projectId_rowNumber_key" ON "BulkRow"("projectId", "rowNumber");

-- CreateIndex
CREATE INDEX "V2QuestionHistory_userId_idx" ON "V2QuestionHistory"("userId");

-- CreateIndex
CREATE INDEX "V2QuestionHistory_teamId_idx" ON "V2QuestionHistory"("teamId");

-- CreateIndex
CREATE INDEX "V2QuestionHistory_createdAt_idx" ON "V2QuestionHistory"("createdAt");

-- CreateIndex
CREATE INDEX "V2QuestionHistory_status_idx" ON "V2QuestionHistory"("status");

-- CreateIndex
CREATE INDEX "V2QuestionHistory_reviewStatus_idx" ON "V2QuestionHistory"("reviewStatus");

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "ChatSession_teamId_idx" ON "ChatSession"("teamId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatBlockUsage_sessionId_idx" ON "ChatBlockUsage"("sessionId");

-- CreateIndex
CREATE INDEX "ChatBlockUsage_blockId_idx" ON "ChatBlockUsage"("blockId");

-- CreateIndex
CREATE INDEX "LLMTrace_sessionId_idx" ON "LLMTrace"("sessionId");

-- CreateIndex
CREATE INDEX "LLMTrace_createdAt_idx" ON "LLMTrace"("createdAt");

-- CreateIndex
CREATE INDEX "LLMTrace_model_createdAt_idx" ON "LLMTrace"("model", "createdAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_queueName_status_idx" ON "BackgroundJob"("queueName", "status");

-- CreateIndex
CREATE INDEX "BackgroundJob_scheduledFor_idx" ON "BackgroundJob"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_teamId_idx" ON "ApiKey"("teamId");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_createdAt_idx" ON "AuditLog"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_teamId_createdAt_idx" ON "AuditLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "SlackBotInteraction_slackTeamId_slackChannelId_idx" ON "SlackBotInteraction"("slackTeamId", "slackChannelId");

-- CreateIndex
CREATE INDEX "SlackBotInteraction_slackUserId_idx" ON "SlackBotInteraction"("slackUserId");

-- CreateIndex
CREATE INDEX "SlackBotInteraction_createdAt_idx" ON "SlackBotInteraction"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingBlock" ADD CONSTRAINT "BuildingBlock_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAssignment" ADD CONSTRAINT "SourceAssignment_stagedSourceId_fkey" FOREIGN KEY ("stagedSourceId") REFERENCES "StagedSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAssignment" ADD CONSTRAINT "SourceAssignment_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "BuildingBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkProject" ADD CONSTRAINT "BulkProject_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkRow" ADD CONSTRAINT "BulkRow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BulkProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatBlockUsage" ADD CONSTRAINT "ChatBlockUsage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatBlockUsage" ADD CONSTRAINT "ChatBlockUsage_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "BuildingBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

