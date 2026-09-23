ALTER TABLE "User" ADD COLUMN "homeCompanyId" UUID;

CREATE TABLE "EmployeeLoan" (
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EmployeeLoan_pkey" PRIMARY KEY ("userId","companyId")
);

CREATE INDEX "EmployeeLoan_companyId_idx" ON "EmployeeLoan"("companyId");

ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "User" AS u
SET "homeCompanyId" = only_one."companyId"
FROM (
    SELECT "userId", (array_agg("companyId"))[1] AS "companyId"
    FROM "Directory"
    GROUP BY "userId"
    HAVING COUNT(*) = 1
) AS only_one
WHERE u."id" = only_one."userId"
  AND u."homeCompanyId" IS NULL;
