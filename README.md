# Shopee Seller Assistant

A profit and pricing calculator for Indonesian (UMKM) Shopee sellers. All money
is in Indonesian Rupiah (IDR). The application computes profit, fees, margin,
markup, break-even price and price recommendations for a seller's fee profile —
with **all financial math performed by a single, audited calculation core** and
never duplicated in the UI.

---

## Architecture

The system is a small set of single-responsibility packages. Money math lives in
one frozen core; every other layer is a thin adapter around it.

```
            ┌─────────────┐      same-origin /api/*       ┌──────────────────┐
 Browser ─▶ │   web (BFF) │ ─────────────────────────────▶│   api (Express)  │
            │  Next.js    │   server-side, injects auth    │   REST + auth    │
            └─────────────┘   + sellerId via BACKEND_URL   └────────┬─────────┘
                                                                     │
                          ┌──────────────────────────────────────────┤
                          ▼                       ▼                    ▼
                   ┌────────────┐         ┌───────────────┐    ┌──────────────┐
                   │  services  │ ───────▶│ repositories  │───▶│ PostgreSQL   │
                   │ (use-cases)│         │ (data access) │    │  (schema)    │
                   └─────┬──────┘         └───────────────┘    └──────────────┘
                         │ delegates ALL math
                         ▼
                   ┌────────────┐
                   │ calc-core  │  pure, deterministic (decimal.js). FROZEN.
                   └────────────┘
```

- **calc-core** — pure functions: fees, discount, profit, break-even,
  recommended price, round-trip verification. Deterministic, `decimal.js`-based,
  no I/O. Treated as frozen.
- **repositories** — `pg`-based data access returning a `Result<T, CalcError>`;
  no business logic.
- **services** — use-cases that load data through repositories and delegate every
  calculation to calc-core (`CalculationService`, `FeeProfileService`,
  `PricingService`, `AuthService`, `SellerProfileService`).
- **api** — Express REST API with HS256 bearer auth, validation and a JSON
  envelope (`{ data }` / `{ error }`). Run directly from TypeScript with `tsx`.
- **web** — Next.js (App Router) UI. A server-side **BFF** (`app/api/*`)
  provisions one user + seller per server boot and injects the bearer token and
  seller id, so the browser never handles auth. The UI renders backend numbers
  and computes nothing financial.

### Why a BFF?

The single-user MVP has no login screen by requirement, but the API is
token-secured. The web server bootstraps one account on boot and proxies all
calls. Consequence: **a server restart provisions a fresh store** (the backend
has no login / get-by-email to re-attach an existing one). This is acceptable for
the MVP and documented under Known limitations.

---

## Installation

Prerequisites: **Docker** + **Docker Compose** (v2). That is all you need to run
the whole stack.

```bash
git clone <your-repo-url> shopee-seller-assistant
cd shopee-seller-assistant
cp .env.example .env
# Edit .env and set a strong AUTH_SECRET (>= 16 chars) and POSTGRES_PASSWORD.
#   openssl rand -hex 32   # handy for AUTH_SECRET
```

### Run the whole stack (one command)

```bash
docker compose --env-file .env up --build
```

Then open **http://localhost:3000**.

- `web`  → http://localhost:3000 (published)
- `api`  → internal `http://api:4000` (publish by uncommenting its `ports:` block)
- `db`   → internal `db:5432` (publish similarly if you want to inspect it)

The database schema is applied automatically on the **first** boot of a fresh
volume. Stop with `Ctrl-C`; remove everything (including data) with
`docker compose down -v`.

---

## Local development (without Docker)

Each package is independent. Node 22+ is recommended.

```bash
# calc-core (no DB)
cd calc-core && npm install && npm test

# repositories / services / api  (need a DATABASE_URL and the schema applied)
cd ../api && npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/shopee
export AUTH_SECRET=dev-secret-at-least-16-chars
npm run start            # tsx src/server.ts  → http://localhost:4000

# web (point the BFF at the running API)
cd ../web && npm install
export BACKEND_URL=http://localhost:4000
npm run dev              # http://localhost:3000
```

Apply the schema once against your local Postgres:

```bash
psql "$DATABASE_URL" -f db/migrations/0001_init.sql
```

Per-package scripts: `npm test`, `npm run typecheck`, and (web) `npm run lint`,
`npm run build`.

---

## Production deployment

The provided images are production-oriented:

- **api** — installs only production dependencies for each backend package and
  runs as the non-root `node` user. The entrypoint handles `SIGTERM`/`SIGINT`
  for graceful shutdown. Scale behind a load balancer is possible, but note the
  per-boot provisioning caveat above (sticky single instance recommended for the
  MVP).
- **web** — a multi-stage build produces an optimized Next.js build and serves it
  with `next start` as the non-root `node` user.
- **db** — official `postgres:16`. For managed Postgres (e.g. Supabase, RDS),
  drop the `db` service, point `DATABASE_URL` at the managed instance and apply
  `db/migrations/0001_init.sql` once.

Checklist:

1. Set a strong, unique `AUTH_SECRET` and `POSTGRES_PASSWORD`.
2. Put the `web` service behind TLS (a reverse proxy such as Caddy/Nginx/Traefik).
3. Back up the `db-data` volume (or use managed Postgres with backups).
4. Keep the API unpublished; expose only the web app.

---

## Folder structure

```
.
├── calc-core/          # Pure calculation core (frozen). decimal.js.
├── repositories/       # pg data-access, Result-returning.
├── services/           # Use-cases; delegate all math to calc-core.
├── api/                # Express REST API (tsx runtime).
│   └── Dockerfile
├── web/                # Next.js App Router UI + server-side BFF.
│   ├── app/            #   pages + app/api/* BFF route handlers
│   ├── components/     #   UI + feature components, charts
│   ├── hooks/          #   TanStack Query hooks
│   ├── services/       #   browser API client (same-origin /api)
│   ├── lib/server/     #   BFF bootstrap + upstream forwarder
│   ├── types/          #   API types + zod schemas/mappers
│   └── Dockerfile
├── db/migrations/      # 0001_init.sql (+ rollback) — auto-applied by compose
├── docker-compose.yml  # one-command full stack
├── .env.example
└── README.md
```

## API endpoints

All responses use a JSON envelope: success `{ "data": ... }`, failure
`{ "error": { "code", "message", "details?" } }`. Protected routes require an
`Authorization: Bearer <token>` header. Money fields are IDR strings; rates are
decimal strings.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET  | `/health` | no | Liveness probe. |
| POST | `/api/auth/register` | no | Create a user, return `{ user, token }`. |
| GET  | `/api/auth/me` | yes | Current user. |
| POST | `/api/sellers` | yes | Create the seller/store. |
| GET  | `/api/sellers` | yes | List sellers. |
| GET  | `/api/sellers/:id` | yes | Get one seller. |
| GET  | `/api/sellers/:sellerId/fee-profile?asOf=YYYY-MM-DD` | yes | Active fee profile as of a date. |
| POST | `/api/sellers/:sellerId/fee-profiles` | yes | Create a fee-profile version. |
| PUT  | `/api/fee-profiles/:id` | yes | Replace a fee-profile version. |
| DELETE | `/api/fee-profiles/:id` | yes | Deactivate a fee-profile version. |
| POST | `/api/calculations/profit` | yes | Profit, fees, margin, markup. |
| POST | `/api/calculations/break-even` | yes | Break-even price + binding caps. |
| POST | `/api/calculations/recommend` | yes | Recommended price for a target mode, with a verified round-trip. |

Recommendation modes: `TARGET_PROFIT`, `TARGET_MARGIN`, `TARGET_MARKUP`,
`MIN_VIABLE`.

## Environment variables

| Variable | Used by | Required | Default | Notes |
| -------- | ------- | -------- | ------- | ----- |
| `DATABASE_URL` | api | yes | — | Postgres connection string. |
| `AUTH_SECRET` | api | yes | — | HS256 signing secret, **≥ 16 chars**. |
| `AUTH_TOKEN_TTL` | api | no | `3600` | Token lifetime (seconds). |
| `PORT` | api / web | no | api `3000`*/web `3000` | Compose sets api `4000`, web `3000`. |
| `BACKEND_URL` | web | no | `http://localhost:4000` | Where the BFF reaches the API. Compose sets `http://api:4000`. |
| `STORE_NAME` | web | no | `Toko Saya` | Provisioned store name. |
| `SELLER_TIER` | web | no | `REGULAR` | `REGULAR\|STAR\|STAR_PLUS\|MALL`. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | db | no | `shopee` | Compose database credentials. |
| `WEB_PORT` | compose | no | `3000` | Host port for the web app. |

\* The API code defaults `PORT` to 3000; **compose pins it to 4000** to avoid
colliding with the web app. Keep this in mind if running the API bare.

## Known limitations

- **Per-boot provisioning.** The single-user BFF creates a new user + seller each
  time the web server starts; there is no login, so a restart yields a fresh
  store. Intended for the single-user MVP.
- **No per-resource authorization.** Any valid token can act on any seller id;
  acceptable for single-user, not for multi-tenant use.
- **Cost model.** The backend cost inputs are `productCost` + `packagingCost`.
  The UI's four cost lines (product, shipping, packaging, other) are summed into
  those two fields at request preparation — this is input aggregation, not a
  calculation.
- **calc-core property test `I5`** is occasionally flaky (a randomized,
  seed-dependent monotonicity check reflecting a documented rounding deviation);
  it passes on re-run and is unrelated to application behavior.
- **Recommendations need a fee profile** active as of the chosen date; otherwise
  the API returns a clear validation error surfaced by the UI.

## Troubleshooting

- **`AUTH_SECRET is required and must be at least 16 characters`** — set a longer
  `AUTH_SECRET` in `.env`.
- **Web shows a 502 / "backend unavailable"** — the API or DB isn't ready yet.
  Compose waits for health checks; on first build allow a few seconds. Check
  `docker compose logs api` and `... logs db`.
- **Schema missing / relation does not exist** — the migration only runs on a
  *fresh* `db-data` volume. Re-initialize with `docker compose down -v` then
  `up` again, or apply `db/migrations/0001_init.sql` manually.
- **A new store appeared after restart** — expected; see per-boot provisioning.
- **Port 3000 already in use** — set `WEB_PORT` in `.env` to a free port.
- **Calculations rejected with a validation error** — ensure a fee profile is
  active for the seller as of the calculation date.
```
