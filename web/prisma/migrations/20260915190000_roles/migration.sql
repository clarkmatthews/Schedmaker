-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "systemKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "permissions" JSONB NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_systemKey_key" ON "Role"("companyId", "systemKey");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default roles for existing companies
INSERT INTO "Role" ("id", "companyId", "name", "systemKey", "sortOrder", "permissions")
SELECT gen_random_uuid(), "id", 'Employee', NULL, 0,
  '{"employees":"none","schedule":"view","company":"none","hours":"none","scheduling":"none","mms":"none","teams":"none","responsibilities":"none","roles":"none"}'::jsonb
FROM "Company";

INSERT INTO "Role" ("id", "companyId", "name", "systemKey", "sortOrder", "permissions")
SELECT gen_random_uuid(), "id", 'Restaurant manager', NULL, 1,
  '{"employees":"edit","schedule":"edit","company":"none","hours":"none","scheduling":"none","mms":"none","teams":"none","responsibilities":"none","roles":"none"}'::jsonb
FROM "Company";

INSERT INTO "Role" ("id", "companyId", "name", "systemKey", "sortOrder", "permissions")
SELECT gen_random_uuid(), "id", 'Administrator', 'administrator', 2,
  '{"employees":"edit","schedule":"edit","company":"edit","hours":"edit","scheduling":"edit","mms":"edit","teams":"edit","responsibilities":"edit","roles":"edit"}'::jsonb
FROM "Company";

-- AlterTable
ALTER TABLE "Directory" ADD COLUMN "roleId" UUID;

UPDATE "Directory" AS d
SET "roleId" = r."id"
FROM "Role" AS r
WHERE r."companyId" = d."companyId"
  AND r."systemKey" = 'administrator'
  AND EXISTS (
    SELECT 1 FROM "Admin" AS a
    WHERE a."companyId" = d."companyId" AND a."userId" = d."userId"
  );

UPDATE "Directory" AS d
SET "roleId" = r."id"
FROM "Role" AS r
WHERE r."companyId" = d."companyId"
  AND r."name" = 'Employee'
  AND d."roleId" IS NULL;

ALTER TABLE "Directory" ALTER COLUMN "roleId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Directory_roleId_idx" ON "Directory"("roleId");

-- AddForeignKey
ALTER TABLE "Directory" ADD CONSTRAINT "Directory_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable
DROP TABLE "Admin";
