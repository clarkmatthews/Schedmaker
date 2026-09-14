ALTER TABLE "User" ADD COLUMN "birthDate" DATE;
ALTER TABLE "Company" ADD COLUMN "minorRules" JSONB;

UPDATE "Company"
SET
  "minorRules" = '{
    "enabled": true,
    "minWorkAge": 14,
    "schoolYearStart": "08-15",
    "schoolYearEnd": "06-05",
    "bands": [
      {
        "minAge": 14,
        "maxAge": 15,
        "schoolDayHours": 3,
        "nonSchoolDayHours": 8,
        "schoolWeekHours": 18,
        "nonSchoolWeekHours": 40,
        "earliestStartMinutes": 420,
        "latestEndMinutes": 1140,
        "summerLatestEndMinutes": 1260
      },
      {
        "minAge": 16,
        "maxAge": 17,
        "schoolDayHours": 4,
        "nonSchoolDayHours": 8,
        "schoolWeekHours": 48,
        "nonSchoolWeekHours": 48,
        "earliestStartMinutes": 300,
        "latestEndMinutes": 1320,
        "latestEndBeforeNonSchoolMinutes": 1470,
        "dayBeforeNonSchoolUsesNonSchoolHours": true
      }
    ]
  }'::jsonb
WHERE "name" = 'Demo Cafe';
