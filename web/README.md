# Schedmaker

The Next.js app for [Schedmaker](../README.md). Employee scheduling for teams, released under the MIT License.

For the feature tour and screenshots, see the [repository README](../README.md).

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

Set `DATABASE_URL` to your Postgres instance and generate `AUTH_SECRET`.

2. Apply migrations and seed demo data (uses `migrate deploy` so it does not need `CREATEDB` for a shadow database):

```bash
npx prisma migrate deploy
npx prisma db seed
```

3. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Seeded login: `manager@schedmaker.local` / `scheduler123`  
Support login: `support@schedmaker.local` / `scheduler123`

## Postgres

This app is configured for the `scheduler` database as `schedUser`. From `web/`:

```bash
npx prisma migrate deploy
npx prisma db seed
```

`docker compose` at the repo root is optional if you want a disposable Postgres on port 5433 instead.

## Notifications

Without Mailgun or Twilio env vars, email and SMS are logged to the server console. Activation and password-reset links appear there in local development.
