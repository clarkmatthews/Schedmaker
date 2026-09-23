ALTER TABLE "Job" ADD COLUMN "hourlyRate" DECIMAL(8,2);

CREATE TABLE "EmployeeJob" (
    "userId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmployeeJob_pkey" PRIMARY KEY ("userId","jobId")
);

CREATE INDEX "EmployeeJob_jobId_idx" ON "EmployeeJob"("jobId");

CREATE UNIQUE INDEX "EmployeeJob_one_primary_per_user" ON "EmployeeJob"("userId") WHERE "primary";

ALTER TABLE "EmployeeJob" ADD CONSTRAINT "EmployeeJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeJob" ADD CONSTRAINT "EmployeeJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
