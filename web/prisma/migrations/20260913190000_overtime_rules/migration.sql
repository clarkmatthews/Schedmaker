ALTER TABLE "Company" ADD COLUMN "overtimeRules" JSONB;

UPDATE "Company"
SET
  "overtimeRules" = '{
    "enabled": true,
    "dailyAfterHours": 8,
    "dailyDoubleAfterHours": 12,
    "weeklyAfterHours": 40,
    "seventhDayEnabled": true,
    "seventhDayDoubleAfterHours": 8
  }'::jsonb
WHERE "name" = 'Demo Cafe';
