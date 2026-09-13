# ESP Scheduler

Employee scheduling for teams: weekly and daily calendars, jobs, meal-break and overtime rules, and company settings.

The app lives in [`web/`](web/).

## Quick start

```bash
cd web
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in as `manager@esp-scheduler.local` / `scheduler123`.

Optional Postgres via Docker (port 5433):

```bash
docker compose up -d
```
