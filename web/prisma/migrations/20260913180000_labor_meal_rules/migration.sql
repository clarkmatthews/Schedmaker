ALTER TABLE "Company" ADD COLUMN "laborState" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Company" ADD COLUMN "mealRules" JSONB;
ALTER TABLE "Directory" ADD COLUMN "mealBreakWaiver" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Company"
SET
  "laborState" = 'CA',
  "mealRules" = '{
    "enabled": true,
    "firstAfterHours": 5,
    "firstMinutes": 30,
    "firstStartByHours": 5,
    "firstWaiverMaxHours": 6,
    "secondAfterHours": 10,
    "secondMinutes": 30,
    "secondStartByHours": 10,
    "secondWaiverMaxHours": 12
  }'::jsonb
WHERE "name" = 'Demo Cafe';
