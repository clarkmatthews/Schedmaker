-- AlterTable
ALTER TABLE "Company" ADD COLUMN "mmsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "mmsAccountSid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Company" ADD COLUMN "mmsAuthToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Company" ADD COLUMN "mmsFromNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Company" ADD COLUMN "mmsManagerPhone" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "MmsScheduleShare" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MmsScheduleShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MmsScheduleShare_expiresAt_idx" ON "MmsScheduleShare"("expiresAt");
