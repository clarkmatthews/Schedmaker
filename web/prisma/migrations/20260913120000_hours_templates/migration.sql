-- AlterTable
ALTER TABLE "Company" ADD COLUMN "hoursTemplateId" UUID;

-- CreateTable
CREATE TABLE "HoursTemplate" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "HoursTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoursTemplateDay" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "weekday" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "scheduleStartSlot" INTEGER NOT NULL DEFAULT 32,
    "scheduleEndSlot" INTEGER NOT NULL DEFAULT 96,
    "businessStartSlot" INTEGER,
    "businessEndSlot" INTEGER,

    CONSTRAINT "HoursTemplateDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HoursTemplate_companyId_idx" ON "HoursTemplate"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "HoursTemplateDay_templateId_weekday_key" ON "HoursTemplateDay"("templateId", "weekday");

-- AddForeignKey
ALTER TABLE "HoursTemplate" ADD CONSTRAINT "HoursTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursTemplateDay" ADD CONSTRAINT "HoursTemplateDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "HoursTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_hoursTemplateId_fkey" FOREIGN KEY ("hoursTemplateId") REFERENCES "HoursTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
