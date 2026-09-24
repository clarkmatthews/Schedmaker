CREATE TABLE "Unavailability" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "weekday" INTEGER,
    "date" DATE,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startMinutes" INTEGER,
    "endMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unavailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Unavailability_userId_idx" ON "Unavailability"("userId");

ALTER TABLE "Unavailability" ADD CONSTRAINT "Unavailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Role"
SET "permissions" = "permissions" || '{"availability":"edit"}'::jsonb
WHERE "name" = 'Restaurant manager';
