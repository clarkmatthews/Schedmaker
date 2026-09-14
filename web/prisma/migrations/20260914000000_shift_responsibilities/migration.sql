-- CreateTable
CREATE TABLE "ShiftResponsibility" (
    "shiftId" UUID NOT NULL,
    "responsibilityId" UUID NOT NULL,

    CONSTRAINT "ShiftResponsibility_pkey" PRIMARY KEY ("shiftId","responsibilityId")
);

-- AddForeignKey
ALTER TABLE "ShiftResponsibility" ADD CONSTRAINT "ShiftResponsibility_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftResponsibility" ADD CONSTRAINT "ShiftResponsibility_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
