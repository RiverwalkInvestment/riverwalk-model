# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run lint     # ESLint
npx prisma generate          # Regenerate Prisma client after schema changes
npx prisma db push           # Sync schema to DB (dev)
npx prisma migrate dev       # Create migration
```

## Architecture

**Stack**: Next.js 16 App Router · TypeScript · Prisma 5 (PostgreSQL) · NextAuth v4 (credentials) · Tailwind v4

**Key design decision**: The original deal modeler logic (2800+ lines of JS with DOM manipulation) is preserved as static files:
- `public/deal-script.js` — main formulas, calculations, UI logic
- `public/deal-registro.js` — registry dataset (large, ~540KB)

The `DealClient.tsx` renders the original HTML via `dangerouslySetInnerHTML` and chains the scripts: `deal-registro.js` → jsPDF CDN → `deal-script.js`. Never convert these scripts to React — they use complex DOM manipulation that would be fragile to port.

**Auth flow**: Credentials (email/password bcrypt) → JWT session → proxy.ts (Next.js 16 middleware) guards `/dashboard` and `/deal`.

**Image uploads**: Stored at `public/uploads/[dealId]/[uuid].[ext]`. The upload container is injected into `.input-panel` via a React portal in `useEffect`. Max 6 photos, max 6 plans.

**Data persistence**: Deal data is captured by querying `input[id]` and `select[id]` DOM elements. Restored by setting `.value` + firing `input`/`change` events. Autosave every 60s.

## Environment

`.env.local` y `.env` ya están creados y configurados con SQLite local. Para arrancar:

```bash
npm run dev   # listo
```

La base de datos SQLite está en `prisma/dev.db` (creada automáticamente). Si se borra o hay cambios de schema: `DATABASE_URL="file:./prisma/dev.db" npx prisma db push`
