-- CreateTable for GeneratedView
CREATE TABLE "GeneratedView" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,
    "usedBlockIds" TEXT[],

    CONSTRAINT "GeneratedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedView_viewId_customerId_key" ON "GeneratedView"("viewId", "customerId");

-- CreateIndex
CREATE INDEX "GeneratedView_customerId_idx" ON "GeneratedView"("customerId");

-- CreateIndex
CREATE INDEX "GeneratedView_viewId_idx" ON "GeneratedView"("viewId");
