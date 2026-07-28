---
name: DB lib rebuild order
description: Must run typecheck:libs after adding schema files before artifact typecheck sees the new exports.
---

## Rule
After adding or changing files in `lib/db/src/schema/`, run `pnpm run typecheck:libs` before running artifact-level typechecks.

**Why:** `lib/db` is a composite TypeScript package that emits declarations. Artifact packages import `@workspace/db` from the emitted `dist/` declarations. If you add new exported members (tables, types) to the schema but haven't rebuilt the lib, the artifact typecheck sees the old declarations and reports "Module '@workspace/db' has no exported member 'newTable'".

**How to apply:**
1. Edit `lib/db/src/schema/` files
2. Run `pnpm run typecheck:libs` (this runs `tsc --build` on all composite libs)
3. Then run `pnpm --filter @workspace/api-server run typecheck`
