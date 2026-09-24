ALTER TABLE "Company" ADD COLUMN "shiftSwapEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ShiftSwapOffer" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "offeredByUserId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftSwapOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftSwapClaim" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "offerId" UUID,
    "claimerUserId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" UUID,

    CONSTRAINT "ShiftSwapClaim_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShiftSwapOffer_companyId_status_idx" ON "ShiftSwapOffer"("companyId", "status");
CREATE INDEX "ShiftSwapOffer_shiftId_idx" ON "ShiftSwapOffer"("shiftId");
CREATE INDEX "ShiftSwapOffer_offeredByUserId_idx" ON "ShiftSwapOffer"("offeredByUserId");
CREATE UNIQUE INDEX "ShiftSwapOffer_one_open_per_shift" ON "ShiftSwapOffer"("shiftId") WHERE "status" = 'open';

CREATE INDEX "ShiftSwapClaim_companyId_status_idx" ON "ShiftSwapClaim"("companyId", "status");
CREATE INDEX "ShiftSwapClaim_shiftId_status_idx" ON "ShiftSwapClaim"("shiftId", "status");
CREATE INDEX "ShiftSwapClaim_claimerUserId_idx" ON "ShiftSwapClaim"("claimerUserId");
CREATE UNIQUE INDEX "ShiftSwapClaim_one_pending_per_user" ON "ShiftSwapClaim"("shiftId", "claimerUserId") WHERE "status" = 'pending';

ALTER TABLE "ShiftSwapOffer" ADD CONSTRAINT "ShiftSwapOffer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftSwapOffer" ADD CONSTRAINT "ShiftSwapOffer_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftSwapOffer" ADD CONSTRAINT "ShiftSwapOffer_offeredByUserId_fkey" FOREIGN KEY ("offeredByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftSwapClaim" ADD CONSTRAINT "ShiftSwapClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftSwapClaim" ADD CONSTRAINT "ShiftSwapClaim_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftSwapClaim" ADD CONSTRAINT "ShiftSwapClaim_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "ShiftSwapOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftSwapClaim" ADD CONSTRAINT "ShiftSwapClaim_claimerUserId_fkey" FOREIGN KEY ("claimerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
