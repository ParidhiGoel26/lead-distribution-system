# Lead Distribution System

Lead generation and distribution platform. Customers submit service enquiries; leads are stored in **MongoDB**, assigned to **exactly 3 providers** using mandatory rules and **persisted round-robin** fair pools, with **monthly quotas** enforced under concurrency.

## Seed data (pre-inserted via `npm run db:seed`)

### Services
- **Service 1** (`SERVICE_1`)
- **Service 2** (`SERVICE_2`)
- **Service 3** (`SERVICE_3`)

### Providers (8 total)
- **Provider 1** … **Provider 8**
- Each provider: **10 leads/month** quota

### Mandatory assignment
| Service | Must always receive |
|---------|---------------------|
| Service 1 | Provider 1 |
| Service 2 | Provider 5 |
| Service 3 | Provider 1 **and** Provider 4 |

### Fair pools (round-robin after mandatory)
| Service | Pool |
|---------|------|
| Service 1 | Providers 2, 3, 4 |
| Service 2 | Providers 6, 7, 8 |
| Service 3 | Providers 2, 3, 5, 6, 7, 8 |

Each lead → **exactly 3 providers** (mandatory first, then fair pool until full).

Fair allocation uses a **persisted cursor** (`FairRotationState`) — not random — survives server restarts, respects monthly quota atomically.

## Tech stack

- Next.js
- React
- MongoDB, Prisma

## Setup

```bash
npm install
docker compose up -d
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000/request-service](http://localhost:3000/request-service).

### Public customer form (`/request-service`)

| Field | Required |
|-------|----------|
| Name | Yes |
| Phone | Yes |
| City | Yes |
| Service type | Yes (dropdown) |
| Description | Yes |

**Duplicate rule (database enforced):** same phone + same service cannot be submitted twice.  
Same phone **may** request different services (e.g. `9999999999` → Service 1 and Service 2).

On submit: lead is saved → providers assigned automatically.

## Feature 2 — Lead distribution

- **3 providers** per lead (mandatory + round-robin fair pool)
- **Monthly quota** 10 per provider (atomic `ProviderMonthlyUsage`)
- **No double assignment** — `@@unique([leadId, providerId])`
- **Persisted state** — `FairRotationState`, quota counters

```bash
npm run test:concurrent
```

## Feature 3 — Provider dashboard (`/dashboard`)

Each provider shows **remaining quota**, **leads received count**, and **assigned leads list** (from MongoDB).  
`/dashboard/[providerId]` adds a live SSE feed for new assignments.

## Feature 4 — Real-time dashboard

`/dashboard` connects to `GET /api/dashboard/stream` (SSE). New assignments and quota resets appear without refresh.

**Test:** keep `/dashboard` open → submit a lead at `/request-service` in another tab → assigned leads appear within seconds.

## Feature 5 — Webhook test panel (`/test-tools`)

Requires in `.env`:

```
TEST_TOOLS_ENABLED=true
WEBHOOK_SECRET=your-secret
```

| Button | Behaviour |
|--------|-----------|
| Simulate payment webhook | Resets all providers to **10 remaining quota** (usage → 0) via idempotent webhook |
| Call webhook 5× | Same idempotency key — only first call applies |
| Generate 10 leads | Parallel lead creation for concurrency testing |

Quota reset is **only** through `POST /api/webhooks/payment-confirmed` (or test panel proxy). Not exposed on the customer form.


## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/enquiries` | Create lead + distribute |
| `GET` | `/api/leads?providerId=` | Provider assignments |
| `GET` | `/api/leads/stream?providerId=` | SSE live updates |
| `GET` | `/api/providers` | Providers, rules, round-robin state |

### Example

```bash
curl -X POST http://localhost:3000/api/enquiries \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Alex Doe",
    "email": "alex@example.com",
    "serviceType": "SERVICE_1",
    "description": "Need help with service 1"
  }'
```

Response includes `assignments` (3 providers) and `skipped` if quota blocked anyone.

## Configuration

Rules live in `src/lib/rules.ts` (`MANDATORY_PROVIDER_NUMBERS`, `FAIR_POOL_PROVIDER_NUMBERS`, `PROVIDERS_PER_LEAD`).

### Author

Paridhi Goel
