---
name: OpenAPI integer vs number
description: Orval v8 generates zod.int() for integer fields which is Zod v4 API — workspace is pinned to Zod v3.
---

## Rule
Use `type: number` instead of `type: integer` in all openapi.yaml schemas.

**Why:** Orval v8.x generates `zod.int()` when it sees `type: integer`. This is a Zod v4 API (`z.int()`). The pnpm-workspace catalog pins `zod: ^3.25.76` (Zod v3) which does not have `.int()` as a standalone method. The generated `lib/api-zod/src/generated/api.ts` fails typecheck with `Property 'int' does not exist on type 'typeof zod'`.

**How to apply:** Whenever writing openapi.yaml, replace all `type: integer` with `type: number`, and `type: ["integer", "null"]` with `type: ["number", "null"]`. The API still works correctly since JSON doesn't distinguish integers from floats.

Similarly, avoid `format: binary` on file upload fields — it generates `zod.instanceof(File)` which fails in Node.js context where DOM types are unavailable. Use `type: string` instead; multer handles actual file validation.
