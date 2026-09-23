CREATE TABLE "CompanyManager" (
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,

    CONSTRAINT "CompanyManager_pkey" PRIMARY KEY ("userId","companyId")
);

CREATE INDEX "CompanyManager_companyId_idx" ON "CompanyManager"("companyId");

ALTER TABLE "CompanyManager" ADD CONSTRAINT "CompanyManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyManager" ADD CONSTRAINT "CompanyManager_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
