-- CreateTable
CREATE TABLE "ShiftBreak" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "stop" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Responsibility" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "teamId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Responsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobResponsibility" (
    "jobId" UUID NOT NULL,
    "responsibilityId" UUID NOT NULL,

    CONSTRAINT "JobResponsibility_pkey" PRIMARY KEY ("jobId","responsibilityId")
);

-- CreateTable
CREATE TABLE "BreakCoverage" (
    "id" UUID NOT NULL,
    "breakId" UUID NOT NULL,
    "responsibilityId" UUID NOT NULL,
    "coveringUserId" UUID,

    CONSTRAINT "BreakCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftBreak_shiftId_idx" ON "ShiftBreak"("shiftId");

-- CreateIndex
CREATE INDEX "Responsibility_companyId_idx" ON "Responsibility"("companyId");

-- CreateIndex
CREATE INDEX "Responsibility_teamId_idx" ON "Responsibility"("teamId");

-- CreateIndex
CREATE INDEX "BreakCoverage_breakId_idx" ON "BreakCoverage"("breakId");

-- CreateIndex
CREATE INDEX "BreakCoverage_responsibilityId_idx" ON "BreakCoverage"("responsibilityId");

-- AddForeignKey
ALTER TABLE "ShiftBreak" ADD CONSTRAINT "ShiftBreak_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobResponsibility" ADD CONSTRAINT "JobResponsibility_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobResponsibility" ADD CONSTRAINT "JobResponsibility_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakCoverage" ADD CONSTRAINT "BreakCoverage_breakId_fkey" FOREIGN KEY ("breakId") REFERENCES "ShiftBreak"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakCoverage" ADD CONSTRAINT "BreakCoverage_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakCoverage" ADD CONSTRAINT "BreakCoverage_coveringUserId_fkey" FOREIGN KEY ("coveringUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
