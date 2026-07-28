# AnonMatch

Anonymous social matching and chat app where users reveal themselves one message at a time.

## Run & Operate

- `pnpm --filter @workspace/anonmatch run dev` — run the frontend (auto-started via workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (auto-started via workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth (auto-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + TailwindCSS v4 + Wouter + Clerk auth
- API: Express 5 + WebSocket (ws) at `/ws` path
- DB: PostgreSQL + Drizzle ORM
- Auth: Clerk (Replit-managed tenant)
- Validation: Zod (v3), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle schema (users, posts, matches, messages)
- `artifacts/api-server/src/routes/` — Express route handlers (users, posts, match)
- `artifacts/api-server/src/lib/ws.ts` — WebSocket connection manager
- `artifacts/api-server/src/lib/auth.ts` — Clerk requireAuth middleware + JIT user provisioning
- `artifacts/anonmatch/src/` — React frontend
- `artifacts/anonmatch/src/pages/` — All app pages (home, feed, chat, profile, history)

## Architecture decisions

- **One active chat lock**: Users can only be in one match at a time; the server enforces this by checking for an existing active match before creating a new one.
- **Progressive unblur**: Computed client-side from `myMessageCount`/`partnerMessageCount` fields returned by the API. Milestones: 5/10/20/50 messages → blur 20px→14px→9px→5px→0px.
- **Blur logic for posts**: Server computes `isBlurred` per post (true if viewer hasn't matched with author and isn't VIP). Client applies CSS filter.
- **WebSocket at `/ws`**: Listed in api-server `artifact.toml` paths so the proxy forwards WS upgrades. Used for real-time: `match_found`, `new_message`, `chat_ended`, `reveal_update`.
- **File uploads**: Multer disk storage → `/tmp/uploads/`, served via `/api/uploads/` static route. 5MB avatar limit, 8MB post image limit.
- **JIT user provisioning**: `requireAuth` middleware creates a DB user row on first request if none exists for the Clerk ID.
- **OpenAPI integer→number**: All integer fields in the spec use `type: number` (not `integer`) to avoid Orval generating `zod.int()` which is Zod v4-only (workspace is pinned to v3).

## Product

- **Landing page**: Mysterious dark landing for signed-out users, auto-redirects signed-in users to /feed
- **Feed**: Public posts with CSS blur for unmatched authors; post creation with optional image
- **Chat**: Anonymous 1-on-1 matching, progressive avatar unblur by message milestones, mutual "Reveal Both" button, strict single-chat lock
- **Profile**: Avatar upload, display name/bio editing, stats dashboard
- **History**: Past ended chat sessions

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm run typecheck:libs` before API server typecheck when DB schema changes (lib declarations go stale)
- Use `type: number` not `type: integer` in openapi.yaml — Orval v8 generates `zod.int()` for integers which is Zod v4 only
- WS path `/ws` must be in api-server artifact.toml `paths` array for proxy to forward WebSocket upgrades
- Clerk dev key warning in console is expected during development
- Uploaded files are stored in `/tmp/uploads/` — ephemeral across restarts in development

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `clerk-auth` skill for Clerk auth setup and customization
